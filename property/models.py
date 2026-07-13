import calendar as _cal
from datetime import date as _date

from django.db import models
from simple_history.models import HistoricalRecords


class Property(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="properties",
    )
    PROPERTY_TYPE_CHOICES = [
        ("single_family", "Single Family"),
        ("condo", "Condo"),
        ("multi_unit", "Multi-Unit"),
        ("commercial", "Commercial"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=100)
    address = models.CharField(max_length=200)
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPE_CHOICES, default="single_family")

    history = HistoricalRecords()

    class Meta:
        verbose_name_plural = "properties"
        ordering = ["name"]

    def __str__(self):
        return self.name


class MaintenanceProject(models.Model):
    CATEGORY_CHOICES = [
        ("HVAC", "HVAC"),
        ("PLUMBING", "Plumbing"),
        ("ELECTRICAL", "Electrical"),
        ("ROOFING", "Roofing"),
        ("PAINTING", "Painting"),
        ("FLOORING", "Flooring"),
        ("APPLIANCE", "Appliance"),
        ("LANDSCAPING", "Landscaping"),
        ("OTHER", "Other"),
    ]
    STATUS_CHOICES = [
        ("planned", "Planned"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("on_hold", "On Hold"),
    ]
    PRIORITY_CHOICES = [
        ("urgent", "Urgent"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]

    prop = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="maintenance_projects")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="OTHER")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned")
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    actual_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    contractor_name = models.CharField(max_length=200, blank=True)
    contractor_phone = models.CharField(max_length=20, blank=True)
    contractor_notes = models.TextField(blank=True)
    frequency_months = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Repeat interval in months. When marked Completed, a new Planned task is auto-created this many months out.",
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["due_date", "title"]

    def __str__(self):
        return f"{self.title} — {self.prop}"

    def save(self, *args, **kwargs):
        if self.pk and self.frequency_months and self.status == "completed":
            prev = MaintenanceProject.objects.filter(pk=self.pk).values_list("status", flat=True).first()
            if prev and prev != "completed":
                base = self.completion_date or _date.today()
                raw_month = base.month - 1 + self.frequency_months
                next_year = base.year + raw_month // 12
                next_month = raw_month % 12 + 1
                next_day = min(base.day, _cal.monthrange(next_year, next_month)[1])
                MaintenanceProject.objects.create(
                    prop=self.prop,
                    title=self.title,
                    description=self.description,
                    category=self.category,
                    priority=self.priority,
                    frequency_months=self.frequency_months,
                    estimated_cost=self.estimated_cost,
                    contractor_name=self.contractor_name,
                    contractor_phone=self.contractor_phone,
                    due_date=_date(next_year, next_month, next_day),
                    status="planned",
                )
        super().save(*args, **kwargs)
