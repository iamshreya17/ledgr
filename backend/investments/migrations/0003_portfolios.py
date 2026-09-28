from django.conf import settings
from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion


def move_existing_investments(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Portfolio = apps.get_model("investments", "Portfolio")
    Investment = apps.get_model("investments", "Investment")
    alias = schema_editor.connection.alias
    for user in User.objects.using(alias).all().iterator():
        portfolio = Portfolio.objects.using(alias).create(user_id=user.pk, name="Personal", is_default=True)
        Investment.objects.using(alias).filter(user_id=user.pk).update(portfolio_id=portfolio.pk)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("investments", "0002_indian_investment_types"),
    ]

    operations = [
        migrations.CreateModel(
            name="Portfolio",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("is_default", models.BooleanField(default=False)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="portfolios", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.AddField(
            model_name="investment", name="portfolio",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="investments", to="investments.portfolio"),
        ),
        migrations.RunPython(move_existing_investments, migrations.RunPython.noop),
        migrations.AddConstraint(model_name="portfolio", constraint=models.UniqueConstraint(condition=Q(is_default=True), fields=("user",), name="one_default_portfolio_per_user")),
        migrations.AddConstraint(model_name="portfolio", constraint=models.UniqueConstraint(fields=("user", "name"), name="unique_portfolio_name_per_user")),
    ]
