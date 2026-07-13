from django.db import models
from django.db.models import Sum
from simple_history.models import HistoricalRecords


class Vacation(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
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
        ("HOTEL", "Hotel"),
        ("CAR", "Car Rental"),
        ("OTHER", "Other"),
    ]

    vacation = models.ForeignKey(Vacation, on_delete=models.CASCADE, related_name="reservations")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    provider = models.CharField(max_length=200)
    confirmation_number = models.CharField(max_length=100)
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    notes = models.TextField(blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["departure_time"]

    def __str__(self):
        return f"{self.get_type_display()} — {self.provider} ({self.confirmation_number})"


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
