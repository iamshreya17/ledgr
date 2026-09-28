from decimal import Decimal
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Goal, Investment, Portfolio, RecurringInvestment, SharedSnapshot, UserPreference, ValuationSnapshot, default_portfolio_for

logger = logging.getLogger(__name__)
SANITY_GAIN_PCT = Decimal("5000")


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = ("view_mode",)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = get_user_model()
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        return get_user_model().objects.create_user(**validated_data)


class SnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValuationSnapshot
        fields = ("id", "date", "value")

    def validate_value(self, value):
        if value < 0:
            raise serializers.ValidationError("Value must be zero or greater.")
        return value


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = ("id", "name", "created_at", "is_default")
        read_only_fields = ("id", "created_at")

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Enter a portfolio name.")
        user = self.context["request"].user
        existing = Portfolio.objects.filter(user=user, name__iexact=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("You already have a portfolio with this name.")
        return name


class GoalSerializer(serializers.ModelSerializer):
    portfolio = serializers.PrimaryKeyRelatedField(queryset=Portfolio.objects.none(), required=False, allow_null=True)

    class Meta:
        model = Goal
        fields = ("id", "name", "target_amount", "target_date", "portfolio", "created_at")
        read_only_fields = ("id", "created_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            fields["portfolio"].queryset = Portfolio.objects.filter(user=request.user)
        return fields

    def validate_target_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Target amount must be greater than zero.")
        return value


class RecurringInvestmentSerializer(serializers.ModelSerializer):
    portfolio = serializers.PrimaryKeyRelatedField(queryset=Portfolio.objects.none(), required=False, allow_null=True)
    next_due_date = serializers.SerializerMethodField()
    installments_count = serializers.IntegerField(read_only=True)
    total_invested = serializers.DecimalField(max_digits=17, decimal_places=2, read_only=True)

    class Meta:
        model = RecurringInvestment
        fields = ("id", "portfolio", "type", "name", "amount_per_installment", "frequency", "start_date", "end_date", "is_active", "next_due_date", "installments_count", "total_invested")
        read_only_fields = ("id", "next_due_date", "installments_count", "total_invested")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            fields["portfolio"].queryset = Portfolio.objects.filter(user=request.user)
        return fields

    def get_next_due_date(self, obj):
        from django.utils import timezone
        return obj.next_due_date(timezone.localdate())

    def validate_amount_per_installment(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        return attrs


class InstallmentSerializer(serializers.Serializer):
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=Decimal("0.01"))


class SharedSnapshotSerializer(serializers.ModelSerializer):
    portfolio = serializers.PrimaryKeyRelatedField(queryset=Portfolio.objects.none(), required=False, allow_null=True)
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = SharedSnapshot
        fields = ("id", "portfolio", "token", "share_url", "created_at", "expires_at", "is_active")
        read_only_fields = ("id", "token", "share_url", "created_at", "is_active")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            fields["portfolio"].queryset = Portfolio.objects.filter(user=request.user)
        return fields

    def get_share_url(self, obj):
        from django.conf import settings
        return f"{settings.FRONTEND_URL}/shared/{obj.token}"

    def validate_expires_at(self, value):
        from django.utils import timezone
        if value and value < timezone.localdate():
            raise serializers.ValidationError("Expiry date cannot be in the past.")
        return value


class InvestmentSerializer(serializers.ModelSerializer):
    gain_loss = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    gain_loss_pct = serializers.DecimalField(max_digits=24, decimal_places=2, read_only=True)
    snapshots = SnapshotSerializer(many=True, read_only=True)
    portfolio = serializers.PrimaryKeyRelatedField(queryset=Portfolio.objects.none(), required=False)

    class Meta:
        model = Investment
        fields = ("id", "portfolio", "type", "name", "purchase_date", "purchase_price", "quantity", "current_value", "notes", "created_at", "updated_at", "last_valuation_date", "days_since_last_update", "gain_loss", "gain_loss_pct", "snapshots")
        read_only_fields = ("id", "created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            fields["portfolio"].queryset = Portfolio.objects.filter(user=request.user)
        return fields

    def create(self, validated_data):
        validated_data.setdefault("portfolio", default_portfolio_for(self.context["request"].user))
        return super().create(validated_data)

    def validate_purchase_price(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("Invested amount must be greater than zero.")
        return value

    def validate_quantity(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_current_value(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Current value must be zero or greater.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        purchase_price = attrs.get("purchase_price", getattr(self.instance, "purchase_price", None))
        current_value = attrs.get("current_value", getattr(self.instance, "current_value", None))
        if purchase_price is not None and current_value is not None and purchase_price > 0:
            gain_pct = (current_value - purchase_price) / purchase_price * 100
            if gain_pct > SANITY_GAIN_PCT:
                logger.warning(
                    "Investment %s has unusually high gain: %.2f%% (invested=%s, current=%s)",
                    self.instance.pk if self.instance else "new", gain_pct, purchase_price, current_value,
                )
        return attrs
