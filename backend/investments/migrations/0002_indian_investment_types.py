from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("investments", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="investment",
            name="type",
            field=models.CharField(
                choices=[
                    ("STOCK", "Stock"),
                    ("MUTUAL_FUND", "Mutual fund"),
                    ("CRYPTO", "Crypto"),
                    ("FD", "Fixed deposit"),
                    ("REAL_ESTATE", "Real estate"),
                    ("GOLD", "Gold"),
                    ("BOND", "Bond"),
                    ("PPF", "Public Provident Fund"),
                    ("EPF", "Employees' Provident Fund"),
                    ("NPS", "National Pension System"),
                    ("RD", "Recurring deposit"),
                    ("SGB", "Sovereign gold bond"),
                    ("OTHER", "Other"),
                ],
                max_length=20,
            ),
        ),
    ]
