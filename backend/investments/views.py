from decimal import Decimal
from datetime import date, timedelta
from math import ceil
import csv
import io

from django.db import transaction
from django.db.models import Count, Sum
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import FormParser, MultiPartParser

from .models import Goal, Investment, Portfolio, RecurringInvestment, SharedSnapshot, UserPreference, ValuationSnapshot, default_portfolio_for, installment_date
from .permissions import IsInvestmentOwner
from .serializers import GoalSerializer, InstallmentSerializer, InvestmentSerializer, PortfolioSerializer, RecurringInvestmentSerializer, RegisterSerializer, SharedSnapshotSerializer, SnapshotSerializer, UserPreferenceSerializer
from .tax import calculate_tax_estimate


def money(value):
    return str(value.quantize(Decimal("0.01")))


def selected_portfolio(request):
    value = request.query_params.get("portfolio")
    if value is None:
        return None
    try:
        portfolio_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError({"portfolio": "Enter a valid portfolio ID."})
    return get_object_or_404(Portfolio.objects.filter(user=request.user), pk=portfolio_id)


def scoped_investments(request, queryset=None):
    queryset = queryset if queryset is not None else Investment.objects.all()
    queryset = queryset.filter(user=request.user)
    portfolio = selected_portfolio(request)
    return queryset.filter(portfolio=portfolio) if portfolio else queryset


def history_for(investments):
    rows = ValuationSnapshot.objects.filter(investment__in=investments).values("investment_id", "date", "value").order_by("date", "id")
    latest = {}
    history = []
    for row in rows:
        latest[row["investment_id"]] = row["value"]
        total = sum(latest.values(), Decimal("0"))
        if history and history[-1]["date"] == row["date"].isoformat():
            history[-1]["total_value"] = money(total)
        else:
            history.append({"date": row["date"].isoformat(), "total_value": money(total)})
    return history


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class UserPreferenceView(generics.RetrieveUpdateAPIView):
    serializer_class = UserPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        preference, _ = UserPreference.objects.get_or_create(user=self.request.user)
        return preference


class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

    @staticmethod
    def _lock_user(user):
        get_user_model().objects.select_for_update().get(pk=user.pk)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self._lock_user(request.user)
            make_default = bool(serializer.validated_data.get("is_default")) or not self.get_queryset().exists()
            if make_default:
                self.get_queryset().filter(is_default=True).update(is_default=False)
            portfolio = serializer.save(user=request.user, is_default=make_default)
        return Response(self.get_serializer(portfolio).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            self._lock_user(request.user)
            portfolio = self.get_object()
            serializer = self.get_serializer(portfolio, data=request.data, partial=kwargs.get("partial", False))
            serializer.is_valid(raise_exception=True)
            desired_default = serializer.validated_data.get("is_default", portfolio.is_default)
            if portfolio.is_default and not desired_default:
                raise ValidationError({"is_default": "Choose another default portfolio first."})
            if desired_default and not portfolio.is_default:
                self.get_queryset().filter(is_default=True).update(is_default=False)
            portfolio = serializer.save()
        return Response(self.get_serializer(portfolio).data)

    def destroy(self, request, *args, **kwargs):
        with transaction.atomic():
            self._lock_user(request.user)
            portfolio = self.get_object()
            if portfolio.investments.exists():
                raise ValidationError({"detail": "Move or delete this portfolio's investments before deleting it."})
            replacement = self.get_queryset().exclude(pk=portfolio.pk).first()
            if not replacement:
                raise ValidationError({"detail": "Every account must have at least one portfolio."})
            was_default = portfolio.is_default
            portfolio.delete()
            if was_default:
                replacement.is_default = True
                replacement.save(update_fields=["is_default"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user).select_related("portfolio")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def progress(self, request, pk=None):
        goal = self.get_object()
        investments = Investment.objects.filter(user=request.user)
        if goal.portfolio_id:
            investments = investments.filter(portfolio_id=goal.portfolio_id)
        current = investments.aggregate(total=Sum("current_value"))["total"] or Decimal("0")
        remaining = max(goal.target_amount - current, Decimal("0"))
        progress_pct = current / goal.target_amount * 100
        today = timezone.localdate()
        projected = None
        on_track = None
        if remaining == 0:
            projected = today
            on_track = today <= goal.target_date
        else:
            recent = [item for item in history_for(investments) if today - timedelta(days=90) <= date.fromisoformat(item["date"]) <= today]
            if len(recent) >= 2:
                first, last = recent[0], recent[-1]
                days = (date.fromisoformat(last["date"]) - date.fromisoformat(first["date"])).days
                growth = (Decimal(last["total_value"]) - Decimal(first["total_value"])) / days if days else Decimal("0")
                if growth > 0:
                    days_to_goal = ceil(remaining / growth)
                    if days_to_goal <= (date.max - today).days:
                        projected = today + timedelta(days=days_to_goal)
                        on_track = projected <= goal.target_date
        return Response({
            "current_amount": money(current),
            "target_amount": money(goal.target_amount),
            "progress_pct": money(progress_pct),
            "remaining_amount": money(remaining),
            "days_remaining": (goal.target_date - today).days,
            "projected_completion_date": projected.isoformat() if projected else None,
            "on_track": on_track,
        })


class RecurringInvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringInvestmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = RecurringInvestment.objects.filter(user=self.request.user).annotate(
            installments_count=Count("installments"), total_invested=Sum("installments__purchase_price")
        )
        if self.action in ("list", "upcoming"):
            portfolio = selected_portfolio(self.request)
            if portfolio:
                queryset = queryset.filter(portfolio=portfolio)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        try:
            days = int(request.query_params.get("days", "30"))
        except ValueError:
            raise ValidationError({"days": "Enter a whole number of days."})
        if not 0 <= days <= 365:
            raise ValidationError({"days": "Days must be between 0 and 365."})
        today = timezone.localdate()
        end = today + timedelta(days=days)
        entries = []
        for recurring in self.get_queryset().filter(is_active=True):
            due = recurring.next_due_date(today)
            step = 1 if recurring.frequency == RecurringInvestment.Frequency.MONTHLY else 3
            index = max(0, ((due.year - recurring.start_date.year) * 12 + due.month - recurring.start_date.month) // step) if due else 0
            while due and due <= end:
                entries.append({"recurring_investment": recurring.pk, "name": recurring.name, "type": recurring.type, "amount": money(recurring.amount_per_installment), "due_date": due.isoformat()})
                index += 1
                due = installment_date(recurring.start_date, index, step)
                if recurring.end_date and due > recurring.end_date:
                    break
        return Response(sorted(entries, key=lambda item: (item["due_date"], item["recurring_investment"])))

    @action(detail=True, methods=["post"], url_path="log-installment")
    def log_installment(self, request, pk=None):
        recurring = self.get_object()
        serializer = InstallmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            investment = Investment.objects.create(
                user=request.user, portfolio=recurring.portfolio or default_portfolio_for(request.user),
                recurring_investment=recurring, type=recurring.type, name=recurring.name,
                purchase_date=serializer.validated_data["date"],
                purchase_price=serializer.validated_data["amount"],
                current_value=serializer.validated_data["amount"], quantity=1,
            )
        return Response(InvestmentSerializer(investment, context={"request": request}).data, status=status.HTTP_201_CREATED)


class SharedSnapshotViewSet(viewsets.ModelViewSet):
    serializer_class = SharedSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]
    pagination_class = None

    def get_queryset(self):
        return SharedSnapshot.objects.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class InvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsInvestmentOwner]

    def get_queryset(self):
        queryset = Investment.objects.filter(user=self.request.user).prefetch_related("snapshots")
        return scoped_investments(self.request, queryset) if self.action == "list" else queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def stale(self, request):
        try:
            threshold = int(request.query_params.get("threshold_days", "90"))
        except ValueError:
            raise ValidationError({"threshold_days": "Enter a whole number of days."})
        if not 0 <= threshold <= 36500:
            raise ValidationError({"threshold_days": "Threshold must be between 0 and 36500 days."})
        items = [item for item in scoped_investments(request).prefetch_related("snapshots") if item.days_since_last_update > threshold]
        items.sort(key=lambda item: (-item.days_since_last_update, item.pk))
        return Response(self.get_serializer(items, many=True).data)

    @action(detail=True, methods=["get"], url_path="tax-estimate")
    def tax_estimate(self, request, pk=None):
        return Response(calculate_tax_estimate(self.get_object()))

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="ledgr-investments.csv"'
        writer = csv.writer(response)
        writer.writerow(["name", "type", "purchase_date", "purchase_price", "quantity", "current_value", "notes", "portfolio_name"])
        for investment in scoped_investments(request).select_related("portfolio").order_by("id"):
            writer.writerow([
                investment.name, investment.type, investment.purchase_date.isoformat(),
                str(investment.purchase_price), str(investment.quantity), str(investment.current_value),
                investment.notes, investment.portfolio.name if investment.portfolio else "",
            ])
        return response

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request):
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Upload a CSV file."})
        try:
            content = upload.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))
            required = {"name", "type", "purchase_date", "purchase_price", "quantity", "current_value", "notes", "portfolio_name"}
            if not reader.fieldnames or not required.issubset(reader.fieldnames):
                raise ValidationError({"file": "CSV must contain these columns: " + ", ".join(sorted(required))})
            selected = selected_portfolio(request)
            created = 0
            errors = []
            for row_number, row in enumerate(reader, start=2):
                try:
                    with transaction.atomic():
                        if None in row:
                            raise ValueError("Too many columns in this row.")
                        data = {key: row.get(key, "") for key in ("name", "type", "purchase_date", "purchase_price", "quantity", "current_value", "notes")}
                        if data["type"] not in Investment.Type.values:
                            raise ValueError(f"Invalid investment type '{data['type']}', expected one of {', '.join(Investment.Type.values)}.")
                        serializer = self.get_serializer(data=data)
                        serializer.is_valid(raise_exception=True)
                        portfolio_name = (row.get("portfolio_name") or "").strip()
                        if len(portfolio_name) > 100:
                            raise ValueError("Portfolio name must be 100 characters or fewer.")
                        portfolio = (Portfolio.objects.filter(user=request.user, name__iexact=portfolio_name).first() or Portfolio.objects.create(user=request.user, name=portfolio_name)) if portfolio_name else (selected or default_portfolio_for(request.user))
                        serializer.save(user=request.user, portfolio=portfolio)
                        created += 1
                except (ValueError, ValidationError) as exc:
                    message = str(exc.detail) if isinstance(exc, ValidationError) else str(exc)
                    errors.append({"row": row_number, "message": message})
            return Response({"created": created, "errors": errors})
        except UnicodeDecodeError:
            raise ValidationError({"file": "CSV must be UTF-8 encoded."})
        except csv.Error:
            raise ValidationError({"file": "Could not parse the CSV file."})

    @action(detail=True, methods=["post"])
    def snapshot(self, request, pk=None):
        investment = self.get_object()
        serializer = SnapshotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            snapshot = serializer.save(investment=investment)
            investment.current_value = snapshot.value
            investment.save(update_fields=["current_value", "updated_at"])
        return Response(SnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)


class SnapshotDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _objects(self, request, investment_id, snapshot_id):
        investment = get_object_or_404(
            Investment.objects.select_for_update().filter(user=request.user), pk=investment_id,
        )
        snapshot = get_object_or_404(ValuationSnapshot.objects.filter(investment=investment), pk=snapshot_id)
        return investment, snapshot

    @staticmethod
    def _latest(investment):
        return investment.snapshots.order_by("-date", "-id").first()

    @staticmethod
    def _sync_current_value(investment, old_latest_id, edited_id):
        latest = SnapshotDetailView._latest(investment)
        if old_latest_id == edited_id or (latest and latest.id == edited_id):
            investment.current_value = latest.value if latest else investment.purchase_price
            investment.save(update_fields=["current_value", "updated_at"])

    def _update(self, request, investment_id, snapshot_id, partial):
        with transaction.atomic():
            investment, snapshot = self._objects(request, investment_id, snapshot_id)
            latest = self._latest(investment)
            old_latest_id = latest.id if latest else None
            serializer = SnapshotSerializer(snapshot, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            self._sync_current_value(investment, old_latest_id, snapshot.id)
            return Response(serializer.data)

    def put(self, request, investment_id, snapshot_id):
        return self._update(request, investment_id, snapshot_id, partial=False)

    def patch(self, request, investment_id, snapshot_id):
        return self._update(request, investment_id, snapshot_id, partial=True)

    def delete(self, request, investment_id, snapshot_id):
        with transaction.atomic():
            investment, snapshot = self._objects(request, investment_id, snapshot_id)
            latest = self._latest(investment)
            old_latest_id = latest.id if latest else None
            snapshot.delete()
            self._sync_current_value(investment, old_latest_id, snapshot_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_summary(request):
    return Response(summary_for(scoped_investments(request)))


def summary_for(investments):
    totals = investments.aggregate(invested=Sum("purchase_price"), value=Sum("current_value"))
    invested = totals["invested"] or Decimal("0")
    value = totals["value"] or Decimal("0")
    gain = value - invested
    breakdown = []
    for row in investments.values("type").annotate(total_value=Sum("current_value"), count=Count("id")).order_by("type"):
        share = row["total_value"] / value * 100 if value else Decimal("0")
        breakdown.append({"type": row["type"], "total_value": money(row["total_value"]), "count": row["count"], "pct_of_portfolio": money(share)})
    return {
        "total_net_worth": money(value),
        "total_invested": money(invested),
        "total_gain_loss": money(gain),
        "total_gain_loss_pct": money(gain / invested * 100 if invested else Decimal("0")),
        "breakdown_by_type": breakdown,
        "stale_investments_count": sum(item.days_since_last_update > 90 for item in investments.prefetch_related("snapshots")),
    }


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_history(request):
    # Carry each investment's latest known valuation forward at every snapshot date.
    return Response(history_for(scoped_investments(request)))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_performers(request):
    investments = list(scoped_investments(request).filter(purchase_price__gt=0))
    investments.sort(key=lambda item: (item.gain_loss_pct, item.pk))

    def row(item):
        return {
            "id": item.pk,
            "name": item.name,
            "type": item.type,
            "gain_loss_pct": money(item.gain_loss_pct),
            "gain_loss": money(item.gain_loss),
        }

    return Response({
        "best": [row(item) for item in reversed(investments[-3:])],
        "worst": [row(item) for item in investments[:3]],
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_tax_estimate(request):
    total = Decimal("0")
    skipped = []
    for investment in scoped_investments(request):
        estimate = calculate_tax_estimate(investment)
        if estimate["estimated_tax"] is None:
            skipped.append({"id": investment.pk, "reason": estimate["note"]})
        else:
            total += Decimal(estimate["estimated_tax"])
    return Response({"estimated_tax": money(total), "skipped_count": len(skipped), "skipped": skipped,
                     "note": "Illustrative sale-today sum. Annual equity thresholds are applied separately to each investment, so the total may understate tax."})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_snapshot(request, token):
    share = get_object_or_404(SharedSnapshot, token=token, is_active=True)
    if share.expires_at and share.expires_at < timezone.localdate():
        from django.http import Http404
        raise Http404
    investments = Investment.objects.filter(user=share.user)
    if share.portfolio_id:
        investments = investments.filter(portfolio_id=share.portfolio_id)
    return Response({"summary": summary_for(investments), "history": history_for(investments)})
