from django import forms
from django.core.exceptions import ValidationError

from .models import CalendarEvent, ExternalCalendarFeed, is_allowed_ical_host

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


class ExternalCalendarFeedForm(forms.ModelForm):
    class Meta:
        model = ExternalCalendarFeed
        fields = ["provider", "ical_url"]
        widgets = {
            "provider": forms.Select(attrs={"class": _INPUT}),
            "ical_url": forms.URLInput(attrs={"class": _INPUT, "placeholder": "https://calendar.google.com/calendar/ical/..."}),
        }

    def clean_ical_url(self):
        # #355 — this URL gets fetched server-side, so it's restricted to the
        # actual calendar providers this feature supports rather than
        # accepting any URL (SSRF shape otherwise: a feed URL could point at
        # an internal service or cloud metadata endpoint).
        url = self.cleaned_data["ical_url"]
        if not is_allowed_ical_host(url):
            raise ValidationError(
                "That doesn't look like a Google Calendar or Outlook calendar link. "
                "Use the 'secret address in iCal format' from your calendar's own settings."
            )
        return url
