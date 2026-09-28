from datetime import date, timedelta
from decimal import Decimal
import csv
import io

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile

from .models import Goal, Investment, Portfolio, RecurringInvestment, SharedSnapshot, UserPreference, ValuationSnapshot
from .tax import calculate_tax_estimate


class InvestmentTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="alice", password="safe-test-password-123")
        self.other = get_user_model().objects.create_user(username="bob", password="safe-test-password-123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def make_investment(self, user=None, **kwargs):
        data = {"user": user or self.user, "type": "STOCK", "name": "Example", "purchase_date": date(2025, 1, 1), "purchase_price": Decimal("100.00"), "quantity": Decimal("1"), "current_value": Decimal("125.00")}
        data.update(kwargs)
        return Investment.objects.create(**data)

    def test_user_preference_is_created_with_simple_default_and_can_be_updated(self):
        self.assertEqual(self.user.preference.view_mode, UserPreference.ViewMode.SIMPLE)
        response = self.client.get("/api/preferences/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"view_mode": "simple"})

        response = self.client.patch("/api/preferences/", {"view_mode": "detailed"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.user.preference.refresh_from_db()
        self.assertEqual(self.user.preference.view_mode, UserPreference.ViewMode.DETAILED)
        self.other.preference.refresh_from_db()
        self.assertEqual(self.other.preference.view_mode, UserPreference.ViewMode.SIMPLE)

    def test_user_preference_rejects_an_unknown_view_mode(self):
        response = self.client.patch("/api/preferences/", {"view_mode": "expert"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("view_mode", response.data)

    def test_gain_loss_and_zero_purchase_edge(self):
        investment = self.make_investment()
        self.assertEqual(investment.gain_loss, Decimal("25.00"))
        self.assertEqual(investment.gain_loss_pct, Decimal("25"))
        investment.purchase_price = Decimal("0")
        self.assertEqual(investment.gain_loss_pct, Decimal("0"))

    def test_summary_across_types(self):
        self.make_investment()
        self.make_investment(type="GOLD", purchase_price=Decimal("200.00"), current_value=Decimal("150.00"))
        self.make_investment(user=self.other, current_value=Decimal("999.00"))
        response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_net_worth"], "275.00")
        self.assertEqual(response.data["total_invested"], "300.00")
        self.assertEqual(response.data["total_gain_loss"], "-25.00")
        self.assertEqual(response.data["total_gain_loss_pct"], "-8.33")
        self.assertEqual({item["type"] for item in response.data["breakdown_by_type"]}, {"STOCK", "GOLD"})

    def test_other_users_investment_is_inaccessible(self):
        investment = self.make_investment(user=self.other)
        self.assertEqual(self.client.get(f"/api/investments/{investment.id}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/investments/{investment.id}/", {"name": "Changed"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/investments/{investment.id}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/investments/{investment.id}/snapshot/", {"date": "2025-02-01", "value": "100"}).status_code, 404)

    def test_snapshot_updates_value_and_history(self):
        first = self.make_investment(current_value=Decimal("100.00"))
        second = self.make_investment(type="GOLD", current_value=Decimal("50.00"))
        response = self.client.post(f"/api/investments/{first.id}/snapshot/", {"date": "2025-01-02", "value": "120.00"})
        self.assertEqual(response.status_code, 201)
        first.refresh_from_db()
        self.assertEqual(first.current_value, Decimal("120.00"))
        ValuationSnapshot.objects.create(investment=second, date=date(2025, 1, 3), value=Decimal("60.00"))
        self.assertEqual(self.client.get("/api/dashboard/history/").data, [
            {"date": "2025-01-02", "total_value": "120.00"},
            {"date": "2025-01-03", "total_value": "180.00"},
        ])

    def test_validation(self):
        response = self.client.post("/api/investments/", {"type": "STOCK", "name": "Bad", "purchase_date": "2025-01-01", "purchase_price": "0", "quantity": "0", "current_value": "-1"})
        self.assertEqual(response.status_code, 400)
        self.assertTrue({"purchase_price", "quantity", "current_value"}.issubset(response.data))

    def test_indian_investment_types_can_be_recorded(self):
        for investment_type in ("PPF", "EPF", "NPS", "RD", "SGB"):
            response = self.client.post("/api/investments/", {
                "type": investment_type, "name": f"My {investment_type}",
                "purchase_date": "2025-01-01", "purchase_price": "1000.00",
                "quantity": "1", "current_value": "1050.00",
            })
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["type"], investment_type)

    def test_snapshot_edit_and_delete_recalculate_latest_value(self):
        investment = self.make_investment(current_value=Decimal("150.00"))
        first = ValuationSnapshot.objects.create(investment=investment, date=date(2025, 1, 2), value=Decimal("120.00"))
        latest = ValuationSnapshot.objects.create(investment=investment, date=date(2025, 1, 3), value=Decimal("150.00"))
        base = f"/api/investments/{investment.id}/snapshots/"

        response = self.client.patch(f"{base}{first.id}/", {"value": "130.00"})
        self.assertEqual(response.status_code, 200)
        investment.refresh_from_db()
        self.assertEqual(investment.current_value, Decimal("150.00"))

        response = self.client.put(f"{base}{latest.id}/", {"date": "2025-01-04", "value": "175.00"})
        self.assertEqual(response.status_code, 200)
        investment.refresh_from_db()
        self.assertEqual(investment.current_value, Decimal("175.00"))

        self.assertEqual(self.client.delete(f"{base}{latest.id}/").status_code, 204)
        investment.refresh_from_db()
        self.assertEqual(investment.current_value, Decimal("130.00"))
        self.assertEqual(self.client.delete(f"{base}{first.id}/").status_code, 204)
        investment.refresh_from_db()
        self.assertEqual(investment.current_value, investment.purchase_price)

    def test_snapshot_edit_can_change_which_entry_is_latest(self):
        investment = self.make_investment(current_value=Decimal("150.00"))
        first = ValuationSnapshot.objects.create(investment=investment, date=date(2025, 1, 2), value=Decimal("120.00"))
        ValuationSnapshot.objects.create(investment=investment, date=date(2025, 1, 3), value=Decimal("150.00"))
        response = self.client.patch(
            f"/api/investments/{investment.id}/snapshots/{first.id}/",
            {"date": "2025-01-05", "value": "180.00"},
        )
        self.assertEqual(response.status_code, 200)
        investment.refresh_from_db()
        self.assertEqual(investment.current_value, Decimal("180.00"))

    def test_snapshot_edit_delete_are_owner_scoped(self):
        investment = self.make_investment(user=self.other)
        snapshot = ValuationSnapshot.objects.create(investment=investment, date=date(2025, 1, 2), value=Decimal("120.00"))
        url = f"/api/investments/{investment.id}/snapshots/{snapshot.id}/"
        self.assertEqual(self.client.put(url, {"date": "2025-01-03", "value": "130.00"}).status_code, 404)
        self.assertEqual(self.client.patch(url, {"value": "130.00"}).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        snapshot.refresh_from_db()
        self.assertEqual(snapshot.value, Decimal("120.00"))

    def test_extreme_gain_is_logged_but_accepted(self):
        with self.assertLogs("investments.serializers", level="WARNING") as logs:
            response = self.client.post("/api/investments/", {
                "type": "STOCK", "name": "Possible typo", "purchase_date": "2025-01-01",
                "purchase_price": "1.00", "quantity": "1", "current_value": "1000.00",
            })
        self.assertEqual(response.status_code, 201)
        self.assertIn("unusually high gain", logs.output[0])

    def test_currency_precision_is_enforced(self):
        response = self.client.post("/api/investments/", {
            "type": "STOCK", "name": "Bad precision", "purchase_date": "2025-01-01",
            "purchase_price": "100.001", "quantity": "1", "current_value": "101.001",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("purchase_price", response.data)
        self.assertIn("current_value", response.data)

    def test_portfolios_are_owner_scoped(self):
        other_portfolio = Portfolio.objects.get(user=self.other, is_default=True)
        response = self.client.get("/api/portfolios/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertNotEqual(response.data[0]["id"], other_portfolio.id)
        self.assertEqual(self.client.get(f"/api/portfolios/{other_portfolio.id}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/portfolios/{other_portfolio.id}/", {"name": "Stolen"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/portfolios/{other_portfolio.id}/").status_code, 404)

    def test_default_portfolio_and_deletion_rules(self):
        original = Portfolio.objects.get(user=self.user, is_default=True)
        self.assertEqual(self.client.delete(f"/api/portfolios/{original.id}/").status_code, 400)
        response = self.client.post("/api/portfolios/", {"name": "Retirement", "is_default": True})
        self.assertEqual(response.status_code, 201)
        original.refresh_from_db()
        self.assertFalse(original.is_default)
        new_default = Portfolio.objects.get(pk=response.data["id"])
        self.assertTrue(new_default.is_default)
        self.assertEqual(Portfolio.objects.filter(user=self.user, is_default=True).count(), 1)
        self.make_investment(portfolio=new_default)
        response = self.client.delete(f"/api/portfolios/{new_default.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Move or delete", str(response.data))

    def test_investment_create_uses_default_and_rejects_foreign_portfolio(self):
        default = Portfolio.objects.get(user=self.user, is_default=True)
        payload = {
            "type": "STOCK", "name": "Fund", "purchase_date": "2025-01-01",
            "purchase_price": "100.00", "quantity": "1", "current_value": "120.00",
        }
        response = self.client.post("/api/investments/", payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["portfolio"], default.id)
        foreign = Portfolio.objects.get(user=self.other, is_default=True)
        self.assertEqual(self.client.post("/api/investments/", {**payload, "portfolio": foreign.id}).status_code, 400)

    def test_dashboard_and_list_filter_by_portfolio(self):
        personal = Portfolio.objects.get(user=self.user, is_default=True)
        retirement = Portfolio.objects.create(user=self.user, name="Retirement")
        first = self.make_investment(portfolio=personal, current_value=Decimal("120.00"))
        second = self.make_investment(portfolio=retirement, current_value=Decimal("300.00"))
        ValuationSnapshot.objects.create(investment=first, date=date(2025, 1, 2), value=Decimal("120.00"))
        ValuationSnapshot.objects.create(investment=second, date=date(2025, 1, 3), value=Decimal("300.00"))
        self.assertEqual(self.client.get("/api/dashboard/summary/").data["total_net_worth"], "420.00")
        self.assertEqual(self.client.get(f"/api/dashboard/summary/?portfolio={retirement.id}").data["total_net_worth"], "300.00")
        self.assertEqual(self.client.get(f"/api/dashboard/history/?portfolio={retirement.id}").data, [{"date": "2025-01-03", "total_value": "300.00"}])
        self.assertEqual([row["id"] for row in self.client.get(f"/api/investments/?portfolio={retirement.id}").data["results"]], [second.id])
        foreign = Portfolio.objects.get(user=self.other, is_default=True)
        self.assertEqual(self.client.get(f"/api/dashboard/summary/?portfolio={foreign.id}").status_code, 404)

    def test_performer_rankings_and_portfolio_filter(self):
        personal = Portfolio.objects.get(user=self.user, is_default=True)
        retirement = Portfolio.objects.create(user=self.user, name="Retirement")
        high = self.make_investment(portfolio=personal, name="High", type="CRYPTO", current_value=Decimal("400.00"))
        low = self.make_investment(portfolio=personal, name="Low", type="GOLD", current_value=Decimal("50.00"))
        middle = self.make_investment(portfolio=personal, name="Middle", current_value=Decimal("110.00"))
        self.make_investment(portfolio=personal, name="Zero base", purchase_price=Decimal("0.00"), current_value=Decimal("999.00"))
        retirement_item = self.make_investment(portfolio=retirement, name="Retirement", current_value=Decimal("120.00"))
        self.make_investment(user=self.other, name="Other user's asset", current_value=Decimal("10000.00"))
        response = self.client.get("/api/dashboard/performers/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["best"]], [high.id, retirement_item.id, middle.id])
        self.assertEqual([item["id"] for item in response.data["worst"]], [low.id, middle.id, retirement_item.id])
        filtered = self.client.get(f"/api/dashboard/performers/?portfolio={retirement.id}")
        self.assertEqual([item["id"] for item in filtered.data["best"]], [retirement_item.id])
        self.assertEqual([item["id"] for item in filtered.data["worst"]], [retirement_item.id])

    def test_csv_import_reports_bad_rows_and_creates_portfolio(self):
        content = (
            "name,type,purchase_date,purchase_price,quantity,current_value,notes,portfolio_name\n"
            "Good stock,STOCK,2025-01-01,100.00,1,120.00,Imported,Family\n"
            "Bad type,stocks,2025-01-01,100.00,1,120.00,,Family\n"
            "Bad amount,GOLD,2025-01-01,0,1,120.00,,Family\n"
            "Good bond,BOND,2025-02-01,200.00,2,210.00,,Retirement\n"
        )
        file = SimpleUploadedFile("investments.csv", content.encode("utf-8"), content_type="text/csv")
        response = self.client.post("/api/investments/import/", {"file": file}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual([item["row"] for item in response.data["errors"]], [3, 4])
        self.assertIn("Invalid investment type", response.data["errors"][0]["message"])
        self.assertTrue(Portfolio.objects.filter(user=self.user, name="Family").exists())
        self.assertTrue(Portfolio.objects.filter(user=self.user, name="Retirement").exists())
        self.assertEqual(Investment.objects.filter(user=self.user).count(), 2)

    def test_csv_export_is_owner_and_portfolio_scoped(self):
        personal = Portfolio.objects.get(user=self.user, is_default=True)
        retirement = Portfolio.objects.create(user=self.user, name="Retirement")
        self.make_investment(portfolio=personal, name="Personal asset")
        self.make_investment(portfolio=retirement, name="Retirement asset")
        self.make_investment(user=self.other, name="Other user's asset")
        response = self.client.get(f"/api/investments/export/?portfolio={retirement.id}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Disposition"].startswith("attachment;"))
        rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8"))))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Retirement asset")
        self.assertEqual(rows[0]["portfolio_name"], "Retirement")

    def test_goal_progress_without_history_has_no_projection(self):
        goal = Goal.objects.create(user=self.user, name="House", target_amount=Decimal("1000.00"), target_date=timezone.localdate() + timedelta(days=100))
        response = self.client.get(f"/api/goals/{goal.id}/progress/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["projected_completion_date"])
        self.assertIsNone(response.data["on_track"])
        self.assertEqual(response.data["current_amount"], "0.00")

    def test_goal_progress_projects_from_recent_history(self):
        today = timezone.localdate()
        portfolio = Portfolio.objects.get(user=self.user, is_default=True)
        investment = self.make_investment(portfolio=portfolio, current_value=Decimal("200.00"))
        ValuationSnapshot.objects.create(investment=investment, date=today - timedelta(days=60), value=Decimal("100.00"))
        ValuationSnapshot.objects.create(investment=investment, date=today - timedelta(days=10), value=Decimal("200.00"))
        goal = Goal.objects.create(user=self.user, portfolio=portfolio, name="Retirement", target_amount=Decimal("300.00"), target_date=today + timedelta(days=60))
        response = self.client.get(f"/api/goals/{goal.id}/progress/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["progress_pct"], "66.67")
        self.assertEqual(response.data["remaining_amount"], "100.00")
        self.assertEqual(response.data["projected_completion_date"], (today + timedelta(days=50)).isoformat())
        self.assertTrue(response.data["on_track"])

    def test_goals_are_owner_scoped_and_portfolio_must_be_owned(self):
        other_goal = Goal.objects.create(user=self.other, name="Private", target_amount=Decimal("1000.00"), target_date=timezone.localdate() + timedelta(days=100))
        self.assertEqual(self.client.get(f"/api/goals/{other_goal.id}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/goals/{other_goal.id}/progress/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/goals/{other_goal.id}/").status_code, 404)
        foreign = Portfolio.objects.get(user=self.other, is_default=True)
        self.assertEqual(self.client.post("/api/goals/", {"name": "Bad", "target_amount": "100", "target_date": "2028-01-01", "portfolio": foreign.id}).status_code, 400)

    def test_recurring_due_dates_and_upcoming(self):
        today = timezone.localdate()
        monthly = RecurringInvestment.objects.create(user=self.user, type="MUTUAL_FUND", name="Monthly", amount_per_installment=Decimal("100.00"), frequency="MONTHLY", start_date=date(2025, 1, 31))
        quarterly = RecurringInvestment.objects.create(user=self.user, type="STOCK", name="Quarterly", amount_per_installment=Decimal("200.00"), frequency="QUARTERLY", start_date=date(2025, 1, 31))
        self.assertEqual(monthly.next_due_date(date(2025, 2, 1)), date(2025, 2, 28))
        self.assertEqual(monthly.next_due_date(date(2025, 3, 1)), date(2025, 3, 31))
        self.assertEqual(quarterly.next_due_date(date(2025, 2, 1)), date(2025, 4, 30))
        self.assertEqual(quarterly.next_due_date(date(2025, 5, 1)), date(2025, 7, 31))
        monthly.start_date = today
        monthly.save()
        response = self.client.get('/api/recurring-investments/upcoming/?days=0')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['name'] for item in response.data], ['Monthly'])

    def test_log_installment_creates_linked_investment_and_is_owner_scoped(self):
        recurring = RecurringInvestment.objects.create(user=self.user, type="MUTUAL_FUND", name="SIP", amount_per_installment=Decimal("500.00"), frequency="MONTHLY", start_date=date(2025, 1, 1))
        other = RecurringInvestment.objects.create(user=self.other, type="STOCK", name="Private", amount_per_installment=Decimal("500.00"), frequency="MONTHLY", start_date=date(2025, 1, 1))
        url = f'/api/recurring-investments/{recurring.pk}/log-installment/'
        response = self.client.post(url, {'date': '2025-02-01', 'amount': '550.00'})
        self.assertEqual(response.status_code, 201, response.data)
        investment = Investment.objects.get(pk=response.data['id'])
        self.assertEqual(investment.recurring_investment, recurring)
        self.assertEqual(investment.purchase_price, Decimal('550.00'))
        self.assertEqual(investment.current_value, Decimal('550.00'))
        self.assertEqual(self.client.get(f'/api/recurring-investments/{other.pk}/').status_code, 404)
        self.assertEqual(self.client.patch(f'/api/recurring-investments/{other.pk}/', {'name': 'Stolen'}).status_code, 404)
        self.assertEqual(self.client.post(f'/api/recurring-investments/{other.pk}/log-installment/', {'date': '2025-02-01', 'amount': '550.00'}).status_code, 404)
        self.assertEqual(self.client.delete(f'/api/recurring-investments/{other.pk}/').status_code, 404)

    def test_tax_estimate_current_rates_and_boundaries(self):
        as_of = date(2026, 9, 22)
        stock = self.make_investment(type='STOCK', purchase_date=as_of - timedelta(days=365), purchase_price=Decimal('100000'), current_value=Decimal('300000'))
        self.assertEqual(calculate_tax_estimate(stock, as_of)['classification'], 'SHORT_TERM')
        self.assertEqual(calculate_tax_estimate(stock, as_of)['estimated_tax'], '40000.00')
        stock.purchase_date -= timedelta(days=1)
        self.assertEqual(calculate_tax_estimate(stock, as_of)['classification'], 'LONG_TERM')
        self.assertEqual(calculate_tax_estimate(stock, as_of)['estimated_tax'], '9375.00')
        for kind in ('MUTUAL_FUND',):
            stock.type = kind
            self.assertEqual(calculate_tax_estimate(stock, as_of)['estimated_tax'], '9375.00')
        for kind in ('GOLD', 'REAL_ESTATE'):
            stock.type = kind
            stock.purchase_date = as_of - timedelta(days=730)
            self.assertEqual(calculate_tax_estimate(stock, as_of)['classification'], 'SHORT_TERM')
            self.assertIsNone(calculate_tax_estimate(stock, as_of)['estimated_tax'])
            stock.purchase_date -= timedelta(days=1)
            self.assertEqual(calculate_tax_estimate(stock, as_of)['estimated_tax'], '25000.00')
        stock.type = 'CRYPTO'
        self.assertEqual(calculate_tax_estimate(stock, as_of)['estimated_tax'], '60000.00')
        for kind in ('FD', 'BOND', 'OTHER'):
            stock.type = kind
            self.assertIsNone(calculate_tax_estimate(stock, as_of)['estimated_tax'])

    def test_tax_endpoint_scope_and_dashboard_skips_unknown_rates(self):
        own = self.make_investment(type='CRYPTO', purchase_date=timezone.localdate() - timedelta(days=30), purchase_price=Decimal('100'), current_value=Decimal('200'))
        self.make_investment(type='FD')
        foreign = self.make_investment(user=self.other, type='CRYPTO')
        self.assertEqual(self.client.get(f'/api/investments/{foreign.pk}/tax-estimate/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/investments/{own.pk}/tax-estimate/').data['estimated_tax'], '30.00')
        response = self.client.get('/api/dashboard/tax-estimate/')
        self.assertEqual(response.data['estimated_tax'], '30.00')
        self.assertEqual(response.data['skipped_count'], 1)

    def test_stale_threshold_with_and_without_snapshots(self):
        today = timezone.localdate()
        no_snapshot = self.make_investment(name='No snapshot')
        Investment.objects.filter(pk=no_snapshot.pk).update(updated_at=timezone.now() - timedelta(days=91))
        with_snapshot = self.make_investment(name='Snapshot')
        ValuationSnapshot.objects.create(investment=with_snapshot, date=today - timedelta(days=90), value=Decimal('125'))
        other = self.make_investment(user=self.other, name='Other user')
        Investment.objects.filter(pk=other.pk).update(updated_at=timezone.now() - timedelta(days=200))
        no_snapshot.refresh_from_db()
        self.assertEqual(no_snapshot.days_since_last_update, 91)
        self.assertEqual(with_snapshot.days_since_last_update, 90)
        response = self.client.get('/api/investments/stale/?threshold_days=90')
        self.assertEqual([item['id'] for item in response.data], [no_snapshot.pk])
        self.assertEqual(self.client.get('/api/dashboard/summary/').data['stale_investments_count'], 1)
        self.assertEqual(self.client.get('/api/investments/stale/?threshold_days=91').data, [])

    def test_public_share_is_aggregate_only_and_revocation_and_expiry_are_404(self):
        portfolio = Portfolio.objects.get(user=self.user, is_default=True)
        investment = self.make_investment(portfolio=portfolio, name='Secret asset', notes='Secret note')
        ValuationSnapshot.objects.create(investment=investment, date=timezone.localdate(), value=Decimal('125.00'))
        response = self.client.post('/api/shared-snapshots/', {'portfolio': portfolio.pk})
        self.assertEqual(response.status_code, 201, response.data)
        token = response.data['token']
        url = f'/api/public/snapshot/{token}/'
        anonymous = APIClient()
        public = anonymous.get(url)
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data['summary']['total_net_worth'], '125.00')
        self.assertNotIn('Secret asset', str(public.data))
        self.assertNotIn('Secret note', str(public.data))
        self.assertEqual(anonymous.get('/api/public/snapshot/invalid/').status_code, 404)
        share = SharedSnapshot.objects.get(token=token)
        share.expires_at = timezone.localdate() - timedelta(days=1)
        share.save()
        self.assertEqual(anonymous.get(url).status_code, 404)
        share.expires_at = None
        share.save()
        self.assertEqual(self.client.delete(f'/api/shared-snapshots/{share.pk}/').status_code, 204)
        self.assertEqual(anonymous.get(url).status_code, 404)

    def test_shared_links_and_portfolio_are_owner_scoped(self):
        other_share = SharedSnapshot.objects.create(user=self.other)
        self.assertEqual(self.client.get('/api/shared-snapshots/').data, [])
        self.assertEqual(self.client.delete(f'/api/shared-snapshots/{other_share.pk}/').status_code, 404)
        foreign = Portfolio.objects.get(user=self.other, is_default=True)
        self.assertEqual(self.client.post('/api/shared-snapshots/', {'portfolio': foreign.pk}).status_code, 400)
