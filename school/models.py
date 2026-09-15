from django.db import models
from simple_history.models import HistoricalRecords


class Student(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        related_name="students",
    )
    name = models.CharField(max_length=100)
    school_name = models.CharField(max_length=150, blank=True)
    grade_level = models.CharField(max_length=30, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
