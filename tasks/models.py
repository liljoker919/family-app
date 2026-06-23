from django.contrib.auth import get_user_model
from django.db import models
from simple_history.models import HistoricalRecords

User = get_user_model()

_PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}


class FamilyTask(models.Model):
    STATUS_CHOICES = [
        ("TODO", "To Do"),
        ("IN_PROGRESS", "In Progress"),
        ("COMPLETED", "Completed"),
    ]
    PRIORITY_CHOICES = [
        ("urgent", "Urgent"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="TODO")
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    assigned_to = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="family_tasks",
    )
    due_date = models.DateField(null=True, blank=True)
    maintenance_project = models.ForeignKey(
        "property.MaintenanceProject",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tasks",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.title


class TaskComment(models.Model):
    task = models.ForeignKey(FamilyTask, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="task_comments")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author} on {self.task}"
