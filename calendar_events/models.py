from django.db import models


class CalendarEvent(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="calendar_events",
    )
    EVENT_TYPE_CHOICES = [
        ("manual", "Manual"),
        ("car", "Car"),
    ]

    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default="manual")
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)
    all_day = models.BooleanField(default=False)
    timezone = models.CharField(max_length=50, default="America/New_York")
    # Infrastructure fields for linking to source records without duplicating data
    source_type = models.CharField(max_length=50, blank=True)
    source_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["start"]

    def __str__(self):
        return f"{self.title} ({self.start.date()})"
