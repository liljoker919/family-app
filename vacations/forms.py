from django import forms

from .models import ItineraryItem, Reservation, Vacation, VacationExpense
from .reservation_types import ALL_EXTRA_FIELDS, EXTRA_FIELD_LABELS, get_type_config

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_SELECT = (
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_TEXTAREA = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class VacationForm(forms.ModelForm):
    class Meta:
        model = Vacation
        fields = ["name", "destination", "start_date", "end_date", "status", "notes"]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Summer Beach Trip 2026"}),
            "destination": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Outer Banks, NC"}),
            "start_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "end_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "status": forms.Select(attrs={"class": _SELECT}),
            "notes": forms.Textarea(attrs={"class": _TEXTAREA, "rows": 3, "placeholder": "Additional notes…"}),
        }


class VacationExpenseForm(forms.ModelForm):
    class Meta:
        model = VacationExpense
        fields = ["date", "category", "description", "amount", "paid_by"]
        widgets = {
            "date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "category": forms.Select(attrs={"class": _SELECT}),
            "description": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Hotel night 1"}),
            "amount": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "paid_by": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Mom"}),
        }


class ReservationForm(forms.ModelForm):
    """Labels, placeholders, required flags and the visible extra fields all
    come from RESERVATION_TYPE_FIELDS for the selected type. Field names (and
    so the POST payload shape) are the same for every type."""

    # Declared explicitly to pin the scheme Django assumes for "example.com"
    # (Django 5.x warns if it's left implicit). Blank is allowed.
    listing_url = forms.URLField(
        required=False,
        max_length=500,
        assume_scheme="https",
        widget=forms.URLInput(attrs={"class": _INPUT}),
    )

    class Meta:
        model = Reservation
        fields = [
            "type", "provider", "confirmation_number", "departure_time", "arrival_time",
            *ALL_EXTRA_FIELDS,
            "notes",
        ]
        widgets = {
            "type": forms.Select(attrs={"class": _SELECT}),
            "provider": forms.TextInput(attrs={"class": _INPUT}),
            "confirmation_number": forms.TextInput(attrs={"class": _INPUT, "style": "font-family: monospace;"}),
            "departure_time": forms.DateTimeInput(attrs={"class": _INPUT, "type": "datetime-local"}),
            "arrival_time": forms.DateTimeInput(attrs={"class": _INPUT, "type": "datetime-local"}),
            "notes": forms.Textarea(attrs={"class": _TEXTAREA, "rows": 3}),
            **{
                name: forms.TextInput(attrs={"class": _INPUT})
                for name in ALL_EXTRA_FIELDS
                if name != "listing_url"
            },
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.type_config = get_type_config(self._current_type())
        self._cleared_extra_fields = []
        self._apply_type_config()

    def _current_type(self):
        if self.is_bound:
            return self.data.get(self.add_prefix("type"), "")
        return self.initial.get("type") or self.instance.type or ""

    def _apply_type_config(self):
        cfg = self.type_config
        for name, field in self.fields.items():
            if name in cfg["labels"]:
                field.label = cfg["labels"][name]
            elif name in EXTRA_FIELD_LABELS:
                field.label = EXTRA_FIELD_LABELS[name]
            placeholder = cfg["placeholders"].get(name)
            if placeholder:
                field.widget.attrs["placeholder"] = placeholder
            else:
                field.widget.attrs.pop("placeholder", None)
            field.required = name in cfg["required"]

    @property
    def rows(self):
        """Fields with the info the template needs to show/hide extras."""
        visible_extras = set(self.type_config["extra_fields"])
        for bound_field in self:
            is_extra = bound_field.name in EXTRA_FIELD_LABELS
            yield {
                "field": bound_field,
                "is_extra": is_extra,
                "hidden": is_extra and bound_field.name not in visible_extras,
            }

    def clean(self):
        cleaned = super().clean()
        cfg = self.type_config
        labels = cfg["labels"]

        # End must be after start — new reservations only, so existing
        # reservations never start failing validation when edited.
        start = cleaned.get("departure_time")
        end = cleaned.get("arrival_time")
        if self.instance.pk is None and start and end and end <= start:
            self.add_error(
                "arrival_time",
                f"{labels['arrival_time']} must be after {labels['departure_time'].lower()}.",
            )

        # Drop extra fields that belong to other types (e.g. a flight number
        # typed before switching to Hotel). They're cleared on save, so any
        # validation error on them is moot too.
        for name in ALL_EXTRA_FIELDS:
            if name not in cfg["extra_fields"]:
                cleaned[name] = ""
                self._errors.pop(name, None)
                self._cleared_extra_fields.append(name)
        return cleaned

    def save(self, commit=True):
        # Fields omitted from the POST keep their stored value (Django's
        # ModelForm behaviour for fields with defaults), so clear other types'
        # extras explicitly.
        for name in self._cleared_extra_fields:
            setattr(self.instance, name, "")
        return super().save(commit=commit)


class ItineraryItemForm(forms.ModelForm):
    class Meta:
        model = ItineraryItem
        fields = ["date", "time", "title", "description", "location"]
        widgets = {
            "date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "time": forms.TimeInput(attrs={"class": _INPUT, "type": "time"}),
            "title": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Snorkeling at Coral Bay"}),
            "description": forms.Textarea(attrs={"class": _TEXTAREA, "rows": 3, "placeholder": "Details…"}),
            "location": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Coral Bay Beach, St. John"}),
        }
