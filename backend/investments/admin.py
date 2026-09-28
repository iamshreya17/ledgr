from django.contrib import admin
from decimal import Decimal

from .models import Goal, Investment, Portfolio, RecurringInvestment, SharedSnapshot, UserPreference, ValuationSnapshot


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "is_default", "created_at")
    search_fields = ("name", "user__username")


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "portfolio", "target_amount", "target_date")


@admin.register(RecurringInvestment)
class RecurringInvestmentAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "portfolio", "amount_per_installment", "frequency", "is_active")


@admin.register(SharedSnapshot)
class SharedSnapshotAdmin(admin.ModelAdmin):
    list_display = ("user", "portfolio", "created_at", "expires_at", "is_active")
    readonly_fields = ("token",)


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "portfolio", "type", "purchase_date", "purchase_price", "current_value", "review_gain")
    list_filter = ("type", "purchase_date")
    search_fields = ("name", "user__username")

    @admin.display(description="Gain check")
    def review_gain(self, obj):
        return "⚠ Possible typo" if obj.gain_loss_pct > Decimal("5000") else "—"


@admin.register(ValuationSnapshot)
class ValuationSnapshotAdmin(admin.ModelAdmin):
    list_display = ("investment", "date", "value")
    list_filter = ("date",)


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "view_mode")
    list_filter = ("view_mode",)
    search_fields = ("user__username", "user__email")
