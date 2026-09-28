from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
import calendar
from datetime import date
import secrets


class Portfolio(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolios")
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["user"], condition=Q(is_default=True), name="one_default_portfolio_per_user"),
            models.UniqueConstraint(fields=["user", "name"], name="unique_portfolio_name_per_user"),
        ]

    def __str__(self):
        return self.name



class UserPreference(models.Model):
    class ViewMode(models.TextChoices):
        SIMPLE = "simple", "Simple"
        DETAILED = "detailed", "Detailed"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preference",
    )
    view_mode = models.CharField(
        max_length=10,
        choices=ViewMode.choices,
        default=ViewMode.SIMPLE,
    )

    def __str__(self):
        return f"{self.user.username}: {self.get_view_mode_display()}"

def default_portfolio_for(user):
    portfolio = Portfolio.objects.filter(user=user, is_default=True).first()
    if portfolio:
        return portfolio
    portfolio = Portfolio.objects.filter(user=user).first()
    if portfolio:
        portfolio.is_default = True
        portfolio.save(update_fields=["is_default"])
        return portfolio
    return Portfolio.objects.create(user=user, name="Personal", is_default=True)


def installment_date(start_date, intervals, months_per_interval):
    months = start_date.year * 12 + start_date.month - 1 + intervals * months_per_interval
    year, month_zero = divmod(months, 12)
    month = month_zero + 1
    return date(year, month, min(start_date.day, calendar.monthrange(year, month)[1]))


class RecurringInvestment(models.Model):
    class Frequency(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        QUARTERLY = "QUARTERLY", "Quarterly"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recurring_investments")
    portfolio = models.ForeignKey(Portfolio, on_delete=models.SET_NULL, null=True, blank=True, related_name="recurring_investments")
    type = models.CharField(max_length=20, choices=[
        ("STOCK", "Stock"), ("MUTUAL_FUND", "Mutual fund"), ("CRYPTO", "Crypto"),
        ("FD", "Fixed deposit"), ("REAL_ESTATE", "Real estate"), ("GOLD", "Gold"),
        ("BOND", "Bond"), ("PPF", "Public Provident Fund"), ("EPF", "Employees' Provident Fund"),
        ("NPS", "National Pension System"), ("RD", "Recurring deposit"),
        ("SGB", "Sovereign gold bond"), ("OTHER", "Other"),
    ])
    name = models.CharField(max_length=200)
    amount_per_installment = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    frequency = models.CharField(max_length=10, choices=Frequency.choices)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]

    def next_due_date(self, today):
        if not self.is_active or (self.end_date and today > self.end_date):
            return None
        step = 1 if self.frequency == self.Frequency.MONTHLY else 3
        elapsed_months = max(0, (today.year - self.start_date.year) * 12 + today.month - self.start_date.month)
        index = elapsed_months // step
        due = installment_date(self.start_date, index, step)
        while due < today:
            index += 1
            due = installment_date(self.start_date, index, step)
        return due if not self.end_date or due <= self.end_date else None

    def __str__(self):
        return self.name


class Investment(models.Model):
    class Type(models.TextChoices):
        STOCK = "STOCK", "Stock"
        MUTUAL_FUND = "MUTUAL_FUND", "Mutual fund"
        CRYPTO = "CRYPTO", "Crypto"
        FD = "FD", "Fixed deposit"
        REAL_ESTATE = "REAL_ESTATE", "Real estate"
        GOLD = "GOLD", "Gold"
        BOND = "BOND", "Bond"
        PPF = "PPF", "Public Provident Fund"
        EPF = "EPF", "Employees' Provident Fund"
        NPS = "NPS", "National Pension System"
        RD = "RD", "Recurring deposit"
        SGB = "SGB", "Sovereign gold bond"
        OTHER = "OTHER", "Other"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="investments")
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, null=True, blank=True, related_name="investments")
    recurring_investment = models.ForeignKey(RecurringInvestment, on_delete=models.SET_NULL, null=True, blank=True, related_name="installments")
    type = models.CharField(max_length=20, choices=Type.choices)
    name = models.CharField(max_length=200)
    purchase_date = models.DateField()
    purchase_price = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    quantity = models.DecimalField(max_digits=15, decimal_places=6, default=1, validators=[MinValueValidator(Decimal("0.000001"))])
    current_value = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-purchase_date", "-id"]

    @property
    def gain_loss(self):
        return self.current_value - self.purchase_price

    @property
    def gain_loss_pct(self):
        if self.purchase_price == 0:
            return Decimal("0")
        return self.gain_loss / self.purchase_price * 100

    @property
    def last_valuation_date(self):
        cached = getattr(self, "_prefetched_objects_cache", {}).get("snapshots")
        latest = max(cached, key=lambda item: (item.date, item.id), default=None) if cached is not None else self.snapshots.order_by("-date", "-id").first()
        return latest.date if latest else timezone.localtime(self.updated_at).date()

    @property
    def days_since_last_update(self):
        return max(0, (timezone.localdate() - self.last_valuation_date).days)

    def __str__(self):
        return self.name


class ValuationSnapshot(models.Model):
    investment = models.ForeignKey(Investment, on_delete=models.CASCADE, related_name="snapshots")
    date = models.DateField()
    value = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])

    class Meta:
        ordering = ["date", "id"]

    def __str__(self):
        return f"{self.investment.name} — {self.date}"


class Goal(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goals")
    name = models.CharField(max_length=200)
    target_amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    target_date = models.DateField()
    portfolio = models.ForeignKey(Portfolio, on_delete=models.SET_NULL, null=True, blank=True, related_name="goals")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["target_date", "id"]

    def __str__(self):
        return self.name


def share_token():
    return secrets.token_urlsafe(32)


class SharedSnapshot(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shared_snapshots")
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, null=True, blank=True, related_name="shared_snapshots")
    token = models.CharField(max_length=64, unique=True, default=share_token, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at", "-id"]
