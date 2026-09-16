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


class Course(models.Model):
    MEETING_DAY_CHOICES = [
        ("mon", "Mon"),
        ("tue", "Tue"),
        ("wed", "Wed"),
        ("thu", "Thu"),
        ("fri", "Fri"),
        ("sat", "Sat"),
        ("sun", "Sun"),
    ]

    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        related_name="courses",
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="courses")
    name = models.CharField(max_length=150)
    color = models.CharField(max_length=7, default="#8B5CF6")
    instructor = models.CharField(max_length=100, blank=True)
    room = models.CharField(max_length=50, blank=True)
    meeting_days = models.JSONField(default=list, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    term = models.CharField(max_length=50, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["student__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.student})"

    @property
    def meeting_days_display(self):
        labels = dict(self.MEETING_DAY_CHOICES)
        return ", ".join(labels.get(day, day) for day in self.meeting_days)
