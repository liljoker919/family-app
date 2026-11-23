from django.db import models
from django.db.models import Sum
from simple_history.models import HistoricalRecords


class Vacation(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        related_name="vacations",
    )
    STATUS_CHOICES = [
        ("planning", "Planning"),
        ("confirmed", "Confirmed"),
        ("completed", "Completed"),
    ]

    name = models.CharField(max_length=200)
    destination = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planning")

    history = HistoricalRecords()

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.name

    @property
    def total_expenses(self):
        result = self.expenses.aggregate(total=Sum("amount"))["total"]
        return result or 0


class VacationExpense(models.Model):
    CATEGORY_CHOICES = [
        ("FLIGHT", "Flight"),
        ("HOTEL", "Hotel"),
        ("FOOD", "Food"),
        ("TRANSPORT", "Transport"),
        ("ACTIVITY", "Activity"),
        ("SHOPPING", "Shopping"),
        ("OTHER", "Other"),
    ]

    vacation = models.ForeignKey(Vacation, on_delete=models.CASCADE, related_name="expenses")
    date = models.DateField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_by = models.CharField(max_length=100)

    history = HistoricalRecords()

    class Meta:
        ordering = ["date", "category"]

    def __str__(self):
        return f"{self.get_category_display()} — {self.description} (${self.amount})"


class Reservation(models.Model):
    TYPE_CHOICES = [
        ("FLIGHT", "Flight"),
        # Stored value stays "HOTEL"; the label also covers vacation rentals.
        ("HOTEL", "Hotel / Rental"),
        ("CAR", "Car Rental"),
        ("OTHER", "Other"),
    ]

    vacation = models.ForeignKey(Vacation, on_delete=models.CASCADE, related_name="reservations")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    provider = models.CharField(max_length=200)
    confirmation_number = models.CharField(max_length=100)
    # Storage fields for every type: the user-facing labels come from
    # vacations.reservation_types (e.g. Check-in / Check-out for hotels).
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    notes = models.TextField(blank=True)

    # Optional type-specific details. Each is only shown for the type(s) listed
    # in RESERVATION_TYPE_FIELDS; all are blank for older reservations.
    # Flight
    flight_number = models.CharField(max_length=20, blank=True, default="")
    departure_airport = models.CharField(max_length=100, blank=True, default="")
    arrival_airport = models.CharField(max_length=100, blank=True, default="")
    # Hotel / Rental
    property_name = models.CharField(max_length=200, blank=True, default="")
    address = models.CharField(max_length=300, blank=True, default="")
    room_type = models.CharField(max_length=100, blank=True, default="")
    host_name = models.CharField(max_length=100, blank=True, default="")
    host_phone = models.CharField(max_length=30, blank=True, default="")
    listing_url = models.URLField(max_length=500, blank=True, default="")
    # Car Rental
    pickup_location = models.CharField(max_length=300, blank=True, default="")
    dropoff_location = models.CharField(max_length=300, blank=True, default="")
    vehicle_class = models.CharField(max_length=100, blank=True, default="")

    history = HistoricalRecords()

    class Meta:
        ordering = ["departure_time"]

    def __str__(self):
        return f"{self.get_type_display()} — {self.provider} ({self.confirmation_number})"

    @property
    def field_config(self):
        from .reservation_types import get_type_config

        return get_type_config(self.type)

    @property
    def extra_details(self):
        """(label, value) pairs for this type's filled-in extra fields."""
        cfg = self.field_config
        return [
            (cfg["labels"][name], getattr(self, name))
            for name in cfg["extra_fields"]
            if getattr(self, name)
        ]

    @property
    def display_title(self):
        return self.property_name or self.provider


class ItineraryItem(models.Model):
    vacation = models.ForeignKey(Vacation, on_delete=models.CASCADE, related_name="itinerary")
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=300, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["date", "time"]

    def __str__(self):
        return f"{self.date} — {self.title}"
