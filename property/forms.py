from django import forms

from .models import MaintenanceProject, Property

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


class MaintenanceProjectForm(forms.ModelForm):
    class Meta:
        model = MaintenanceProject
        fields = [
            "title", "category", "status", "priority",
            "description",
            "estimated_cost", "actual_cost",
            "due_date", "completion_date",
            "contractor_name", "contractor_phone", "contractor_notes",
            "frequency_months",
        ]
        widgets = {
            "title": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Replace HVAC filter"}),
            "category": forms.Select(attrs={"class": _SELECT}),
            "status": forms.Select(attrs={"class": _SELECT}),
            "priority": forms.Select(attrs={"class": _SELECT}),
            "description": forms.Textarea(attrs={"class": _INPUT, "rows": 3, "placeholder": "Optional details"}),
            "estimated_cost": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "actual_cost": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "due_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "completion_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "contractor_name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Vendor or contractor name"}),
            "contractor_phone": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Phone number"}),
            "contractor_notes": forms.Textarea(attrs={"class": _INPUT, "rows": 2, "placeholder": "License, notes, etc."}),
            "frequency_months": forms.NumberInput(attrs={"class": _INPUT, "min": "1", "max": "60", "placeholder": "e.g. 3 (quarterly)"}),
        }
