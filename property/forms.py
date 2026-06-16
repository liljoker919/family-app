from django import forms

from .models import Property, PropertyTransaction

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_SELECT = (
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class PropertyForm(forms.ModelForm):
    class Meta:
        model = Property
        fields = ["name", "address", "property_type"]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Main Street Rental"}),
            "address": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Street address"}),
            "property_type": forms.Select(attrs={"class": _SELECT}),
        }


class PropertyTransactionForm(forms.ModelForm):
    class Meta:
        model = PropertyTransaction
        fields = ["category", "amount", "description", "date"]
        widgets = {
            "category": forms.Select(attrs={"class": _SELECT}),
            "amount": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "description": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Optional note"}),
            "date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
        }
