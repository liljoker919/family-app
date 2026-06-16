import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Property",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("address", models.CharField(max_length=200)),
                ("property_type", models.CharField(
                    choices=[
                        ("single_family", "Single Family"),
                        ("condo", "Condo"),
                        ("multi_unit", "Multi-Unit"),
                        ("commercial", "Commercial"),
                        ("other", "Other"),
                    ],
                    default="single_family",
                    max_length=20,
                )),
            ],
            options={
                "verbose_name_plural": "properties",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="PropertyTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(
                    choices=[
                        ("RENT_INCOME", "Rent Income"),
                        ("MORTGAGE", "Mortgage"),
                        ("TAXES", "Taxes"),
                        ("MAINTENANCE", "Maintenance"),
                        ("INSURANCE", "Insurance"),
                    ],
                    max_length=20,
                )),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("description", models.CharField(blank=True, max_length=200)),
                ("date", models.DateField()),
                ("prop", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="transactions",
                    to="property.property",
                )),
            ],
            options={
                "ordering": ["-date"],
            },
        ),
    ]
