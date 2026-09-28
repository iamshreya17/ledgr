from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="Investment", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("type", models.CharField(choices=[("STOCK", "Stock"), ("MUTUAL_FUND", "Mutual fund"), ("CRYPTO", "Crypto"), ("FD", "Fixed deposit"), ("REAL_ESTATE", "Real estate"), ("GOLD", "Gold"), ("BOND", "Bond"), ("OTHER", "Other")], max_length=20)),
            ("name", models.CharField(max_length=200)),
            ("purchase_date", models.DateField()),
            ("purchase_price", models.DecimalField(decimal_places=2, max_digits=15, validators=[MinValueValidator(Decimal("0.01"))])),
            ("quantity", models.DecimalField(decimal_places=6, default=1, max_digits=15, validators=[MinValueValidator(Decimal("0.000001"))])),
            ("current_value", models.DecimalField(decimal_places=2, max_digits=15, validators=[MinValueValidator(Decimal("0"))])),
            ("notes", models.TextField(blank=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="investments", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering": ["-purchase_date", "-id"]}),
        migrations.CreateModel(name="ValuationSnapshot", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("date", models.DateField()),
            ("value", models.DecimalField(decimal_places=2, max_digits=15, validators=[MinValueValidator(Decimal("0"))])),
            ("investment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="snapshots", to="investments.investment")),
        ], options={"ordering": ["date", "id"]}),
    ]
