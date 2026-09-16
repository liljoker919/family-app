from datetime import date

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


class Assignment(models.Model):
    TYPE_CHOICES = [
        ("homework", "Homework"),
        ("quiz", "Quiz"),
        ("exam", "Exam"),
        ("project", "Project"),
        ("reading", "Reading"),
    ]
    STATUS_CHOICES = [
        ("not_started", "Not Started"),
        ("in_progress", "In Progress"),
        ("done", "Done"),
    ]
    _TYPE_WEIGHT = {"exam": -2, "project": -1, "quiz": 0, "homework": 1, "reading": 1}

    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assignments")
    # Denormalized so dashboard/calendar queries can filter by student
    # without joining through course.
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="assignments")

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="homework")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="not_started")
    due_date = models.DateField()
    due_time = models.TimeField(null=True, blank=True)
    estimated_minutes = models.PositiveIntegerField(null=True, blank=True)

    # Optional cross-links — a family isn't required to use either; nothing
    # in this ticket writes to them yet (see docs/roadmap/STUDENT_COURSEWORK_TRACKER.md).
    linked_task = models.ForeignKey(
        "tasks.FamilyTask", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    linked_event = models.ForeignKey(
        "calendar_events.CalendarEvent", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["due_date", "due_time"]

    def __str__(self):
        return f"{self.title} — {self.course}"

    @property
    def priority_score(self):
        """Lower is more urgent. Combines due-date proximity, type weight,
        and estimated effort so lists can sort by something smarter than
        raw due_date."""
        days_out = (self.due_date - date.today()).days
        type_weight = self._TYPE_WEIGHT.get(self.type, 0)
        effort_weight = (self.estimated_minutes or 30) / 60
        return days_out + type_weight + effort_weight


class Subtask(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.title
