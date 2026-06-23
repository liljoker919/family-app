from django import forms
from django.contrib.auth import get_user_model

from .models import FamilyTask, TaskComment

User = get_user_model()

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm "
    "shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_SELECT = (
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm "
    "shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class FamilyTaskForm(forms.ModelForm):
    class Meta:
        model = FamilyTask
        fields = [
            "title", "description", "status", "priority",
            "assigned_to", "due_date", "maintenance_project",
        ]
        widgets = {
            "title": forms.TextInput(attrs={"class": _INPUT, "placeholder": "What needs to get done?"}),
            "description": forms.Textarea(attrs={"class": _INPUT, "rows": 3, "placeholder": "Optional details…"}),
            "status": forms.Select(attrs={"class": _SELECT}),
            "priority": forms.Select(attrs={"class": _SELECT}),
            "assigned_to": forms.Select(attrs={"class": _SELECT}),
            "due_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "maintenance_project": forms.Select(attrs={"class": _SELECT}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["assigned_to"].queryset = (
            User.objects.filter(is_active=True).order_by("first_name", "username")
        )
        self.fields["assigned_to"].label_from_instance = (
            lambda u: u.get_full_name() or u.username
        )
        self.fields["assigned_to"].empty_label = "— Unassigned —"
        self.fields["maintenance_project"].empty_label = "— None —"


class TaskCommentForm(forms.ModelForm):
    class Meta:
        model = TaskComment
        fields = ["body"]
        widgets = {
            "body": forms.Textarea(attrs={
                "class": _INPUT,
                "rows": 2,
                "placeholder": "Add a note…",
            }),
        }
        labels = {"body": ""}
