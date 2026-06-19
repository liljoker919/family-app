from django import forms

from .models import MaintenanceProject, Mortgage, Property, PropertyTransaction

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
        fields = [
            "name", "address", "property_type",
            "purchase_price", "current_value", "purchase_date",
        ]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Main Street Rental"}),
            "address": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Street address"}),
            "property_type": forms.Select(attrs={"class": _SELECT}),
            "purchase_price": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "current_value": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "purchase_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
        }


class MortgageForm(forms.ModelForm):
    class Meta:
        model = Mortgage
        fields = [
            "lender", "original_amount", "current_balance",
            "monthly_payment", "interest_rate", "start_date", "term_years",
        ]
        widgets = {
            "lender": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Wells Fargo"}),
            "original_amount": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "current_balance": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "monthly_payment": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "interest_rate": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "max": "100", "placeholder": "e.g. 6.50"}),
            "start_date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "term_years": forms.NumberInput(attrs={"class": _INPUT, "min": "1", "max": "50", "placeholder": "30"}),
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
