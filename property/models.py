import calendar as _cal
from datetime import date as _date
from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.db.models import Sum
from simple_history.models import HistoricalRecords

INCOME_CATEGORIES = {"RENT_INCOME"}


class Property(models.Model):
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

    # Financial snapshot fields — all optional so existing records are unaffected
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name_plural = "properties"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def equity(self):
        if not self.current_value:
            return Decimal("0")
        try:
            return self.current_value - self.mortgage.current_balance
        except ObjectDoesNotExist:
            return self.current_value

    def calculate_totals(self, year=None, month=None):
        qs = self.transactions.all()
        if year:
            qs = qs.filter(date__year=year)
        if month:
            qs = qs.filter(date__month=month)

        income = (
            qs.filter(category__in=INCOME_CATEGORIES).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        expenses = (
            qs.exclude(category__in=INCOME_CATEGORIES).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )

        return {"income": income, "expenses": expenses, "net": income - expenses}


class Mortgage(models.Model):
    # OneToOneField named 'prop' to mirror the pattern used by PropertyTransaction
    prop = models.OneToOneField(
        Property,
        on_delete=models.CASCADE,
        related_name="mortgage",
        null=True,
        blank=True,
    )
    lender = models.CharField(max_length=150)
    original_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2)
    monthly_payment = models.DecimalField(max_digits=10, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2)
    start_date = models.DateField()
    term_years = models.PositiveSmallIntegerField(default=30)

    history = HistoricalRecords()

    def __str__(self):
        return f"{self.lender} — {self.prop}"


class PropertyTransaction(models.Model):
    CATEGORY_CHOICES = [
        ("RENT_INCOME", "Rent Income"),
        ("MORTGAGE", "Mortgage"),
        ("TAXES", "Taxes"),
        ("MAINTENANCE", "Maintenance"),
        ("INSURANCE", "Insurance"),
        ("WATER", "Water"),
        ("ELECTRIC", "Electric"),
        ("INTERNET", "Internet"),
        ("PEST_CONTROL", "Pest Control"),
        ("SUPPLIES", "Supplies"),
        ("LAWN", "Lawn Care"),
        ("OTHER", "Other"),
    ]

    # Field is named 'prop' to avoid shadowing Python's built-in property() in this module
    prop = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="transactions")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)
    date = models.DateField()

    history = HistoricalRecords()

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.get_category_display()} — ${self.amount} ({self.date})"

    @property
    def transaction_type(self):
        return "income" if self.category in INCOME_CATEGORIES else "expense"


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


class Guest(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class GuestBooking(models.Model):
    SOURCE_CHOICES = [
        ("AIRBNB", "AirBnB"),
        ("VRBO", "VRBO"),
        ("DIRECT", "Direct"),
        ("HOUFY", "Houfy"),
        ("FACEBOOK", "Facebook"),
        ("FRIEND", "Friend"),
        ("REPEAT", "Repeat"),
        ("OTHER", "Other"),
    ]

    prop = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="bookings")
    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name="bookings")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="OTHER")
    start_date = models.DateField()
    end_date = models.DateField()
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)

    # Direct-booking payment tracking; left blank for platform bookings (AirBnB/VRBO/Houfy
    # collect payment themselves).
    deposit_due = models.DateField(null=True, blank=True)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    deposit_received = models.BooleanField(default=False)
    balance_due = models.DateField(null=True, blank=True)
    balance_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    balance_received = models.BooleanField(default=False)

    transaction = models.OneToOneField(
        PropertyTransaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="booking",
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.guest} — {self.prop} ({self.start_date})"

    @property
    def nights(self):
        return (self.end_date - self.start_date).days

    @property
    def per_night_price(self):
        n = self.nights
        return (self.total_cost / n) if n else Decimal("0")

    def _sync_transaction(self):
        description = f"{self.get_source_display()} - {self.guest.name}"
        if self.transaction_id:
            PropertyTransaction.objects.filter(pk=self.transaction_id).update(
                prop=self.prop,
                category="RENT_INCOME",
                amount=self.total_cost,
                description=description,
                date=self.start_date,
            )
        else:
            txn = PropertyTransaction.objects.create(
                prop=self.prop,
                category="RENT_INCOME",
                amount=self.total_cost,
                description=description,
                date=self.start_date,
            )
            GuestBooking.objects.filter(pk=self.pk).update(transaction=txn)
            self.transaction_id = txn.pk

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self._sync_transaction()

    def delete(self, *args, **kwargs):
        transaction_id = self.transaction_id
        super().delete(*args, **kwargs)
        if transaction_id:
            PropertyTransaction.objects.filter(pk=transaction_id).delete()
