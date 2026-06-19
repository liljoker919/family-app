from datetime import date

from django.db import models
from simple_history.models import HistoricalRecords


class Vehicle(models.Model):
    year = models.PositiveSmallIntegerField()
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    vin = models.CharField(max_length=17, unique=True)
    color = models.CharField(max_length=30)
    license_plate = models.CharField(max_length=20)
    current_mileage = models.PositiveIntegerField()
    registration_expiry = models.DateField()

    history = HistoricalRecords()

    class Meta:
        ordering = ["year", "make", "model"]

    def __str__(self):
        return f"{self.year} {self.make} {self.model}"

    @property
    def registration_status(self):
        delta = (self.registration_expiry - date.today()).days
        if delta < 0:
            return "expired"
        if delta <= 30:
            return "expiring_soon"
        return "current"


class VehicleService(models.Model):
    SERVICE_CHOICES = [
        ("oil_change", "Oil Change"),
        ("tire_rotation", "Tire Rotation"),
        ("brake_service", "Brake Service"),
        ("inspection", "Inspection"),
        ("other", "Other"),
    ]

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="services")
    service_type = models.CharField(max_length=20, choices=SERVICE_CHOICES)
    description = models.TextField(blank=True)
    date = models.DateField()
    mileage_at_service = models.PositiveIntegerField()
    cost = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    provider = models.CharField(max_length=100, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["-date", "-mileage_at_service"]

    def __str__(self):
        return f"{self.get_service_type_display()} — {self.vehicle} ({self.date})"
