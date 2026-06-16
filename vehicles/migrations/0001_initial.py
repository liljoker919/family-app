import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Vehicle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.PositiveSmallIntegerField()),
                ("make", models.CharField(max_length=50)),
                ("model", models.CharField(max_length=50)),
                ("vin", models.CharField(max_length=17, unique=True)),
                ("color", models.CharField(max_length=30)),
                ("license_plate", models.CharField(max_length=20)),
                ("current_mileage", models.PositiveIntegerField()),
                ("registration_expiry", models.DateField()),
            ],
            options={
                "ordering": ["year", "make", "model"],
            },
        ),
        migrations.CreateModel(
            name="VehicleService",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("service_type", models.CharField(
                    choices=[
                        ("oil_change", "Oil Change"),
                        ("tire_rotation", "Tire Rotation"),
                        ("brake_service", "Brake Service"),
                        ("inspection", "Inspection"),
                        ("other", "Other"),
                    ],
                    max_length=20,
                )),
                ("description", models.TextField(blank=True)),
                ("date", models.DateField()),
                ("mileage_at_service", models.PositiveIntegerField()),
                ("cost", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("provider", models.CharField(blank=True, max_length=100)),
                ("vehicle", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="services",
                    to="vehicles.vehicle",
                )),
            ],
            options={
                "ordering": ["-date", "-mileage_at_service"],
            },
        ),
    ]
