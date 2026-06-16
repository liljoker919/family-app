from decimal import Decimal

from django.db import models
from django.db.models import Sum

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

    class Meta:
        verbose_name_plural = "properties"
        ordering = ["name"]

    def __str__(self):
        return self.name

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


class PropertyTransaction(models.Model):
    CATEGORY_CHOICES = [
        ("RENT_INCOME", "Rent Income"),
        ("MORTGAGE", "Mortgage"),
        ("TAXES", "Taxes"),
        ("MAINTENANCE", "Maintenance"),
        ("INSURANCE", "Insurance"),
    ]

    # Field is named 'prop' to avoid shadowing Python's built-in property() in this module
    prop = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="transactions")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)
    date = models.DateField()

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.get_category_display()} — ${self.amount} ({self.date})"

    @property
    def transaction_type(self):
        return "income" if self.category in INCOME_CATEGORIES else "expense"
