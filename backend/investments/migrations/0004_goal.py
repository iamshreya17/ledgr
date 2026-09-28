from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("investments", "0003_portfolios"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="Goal", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("name", models.CharField(max_length=200)),
            ("target_amount", models.DecimalField(decimal_places=2, max_digits=15, validators=[MinValueValidator(Decimal("0.01"))])),
            ("target_date", models.DateField()),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("portfolio", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="goals", to="investments.portfolio")),
            ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="goals", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering": ["target_date", "id"]}),
    ]
