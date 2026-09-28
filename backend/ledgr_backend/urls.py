from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from investments.views import GoalViewSet, InvestmentViewSet, PortfolioViewSet, RecurringInvestmentViewSet, SharedSnapshotViewSet, RegisterView, SnapshotDetailView, UserPreferenceView, dashboard_history, dashboard_performers, dashboard_summary, dashboard_tax_estimate, public_snapshot

router = DefaultRouter()
router.register("investments", InvestmentViewSet, basename="investment")
router.register("portfolios", PortfolioViewSet, basename="portfolio")
router.register("goals", GoalViewSet, basename="goal")
router.register("recurring-investments", RecurringInvestmentViewSet, basename="recurring-investment")
router.register("shared-snapshots", SharedSnapshotViewSet, basename="shared-snapshot")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/register/", RegisterView.as_view()),
    path("api/auth/login/", TokenObtainPairView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/preferences/", UserPreferenceView.as_view()),
    path("api/dashboard/summary/", dashboard_summary),
    path("api/dashboard/history/", dashboard_history),
    path("api/dashboard/performers/", dashboard_performers),
    path("api/dashboard/tax-estimate/", dashboard_tax_estimate),
    path("api/public/snapshot/<str:token>/", public_snapshot),
    path("api/investments/<int:investment_id>/snapshots/<int:snapshot_id>/", SnapshotDetailView.as_view()),
    path("api/", include(router.urls)),
]
