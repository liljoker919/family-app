from django import forms

from .models import CalendarEvent

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_TEXTAREA = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class CalendarEventForm(forms.ModelForm):
    class Meta:
        model = CalendarEvent
        fields = ["title", "notes", "start", "end", "all_day", "timezone"]
        widgets = {
            "title": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Event title"}),
            "notes": forms.Textarea(attrs={"class": _TEXTAREA, "rows": 3, "placeholder": "Optional notes…"}),
            "start": forms.DateTimeInput(
                attrs={"class": _INPUT, "type": "datetime-local"},
                format="%Y-%m-%dT%H:%M",
            ),
            "end": forms.DateTimeInput(
                attrs={"class": _INPUT, "type": "datetime-local"},
                format="%Y-%m-%dT%H:%M",
            ),
            "all_day": forms.CheckboxInput(
                attrs={"class": "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"}
            ),
            "timezone": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. America/New_York"}),
        }
