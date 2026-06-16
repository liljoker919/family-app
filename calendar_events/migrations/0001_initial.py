from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="CalendarEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("notes", models.TextField(blank=True)),
                ("event_type", models.CharField(
                    choices=[("manual", "Manual"), ("car", "Car")],
                    default="manual",
                    max_length=20,
                )),
                ("start", models.DateTimeField()),
                ("end", models.DateTimeField(blank=True, null=True)),
                ("all_day", models.BooleanField(default=False)),
                ("timezone", models.CharField(default="America/New_York", max_length=50)),
                ("source_type", models.CharField(blank=True, max_length=50)),
                ("source_id", models.PositiveIntegerField(blank=True, null=True)),
            ],
            options={
                "ordering": ["start"],
            },
        ),
    ]
