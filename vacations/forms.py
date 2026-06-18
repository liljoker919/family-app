from django import forms

from .models import ItineraryItem, Reservation, Vacation, VacationExpense

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
    class Meta:
        model = Reservation
        fields = ["type", "provider", "confirmation_number", "departure_time", "arrival_time", "notes"]
        widgets = {
            "type": forms.Select(attrs={"class": _SELECT}),
            "provider": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Delta, Hilton"}),
            "confirmation_number": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. ABC123", "style": "font-family: monospace;"}),
            "departure_time": forms.DateTimeInput(attrs={"class": _INPUT, "type": "datetime-local"}),
            "arrival_time": forms.DateTimeInput(attrs={"class": _INPUT, "type": "datetime-local"}),
            "notes": forms.Textarea(attrs={"class": _TEXTAREA, "rows": 3, "placeholder": "Seat numbers, meal preferences…"}),
        }


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
