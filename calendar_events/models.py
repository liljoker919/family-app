from django.db import models


class ExternalCalendarFeed(models.Model):
    """A per-account iCal feed URL (Google or Outlook "secret address in
    iCal format") to pull read-only events from — see #338. Unlike the
    original 7 root models, this one is new with no legacy single-tenant
    data to backfill, so account is required from the start rather than
    nullable."""

    PROVIDER_GOOGLE = "google"
    PROVIDER_OUTLOOK = "outlook"
    PROVIDER_CHOICES = [(PROVIDER_GOOGLE, "Google Calendar"), (PROVIDER_OUTLOOK, "Outlook")]

    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        related_name="calendar_feeds",
    )
    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES)
    ical_url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_provider_display()} feed for {self.account}"


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
