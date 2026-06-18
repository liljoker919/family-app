from django import forms

from .models import Mortgage, Property, PropertyTransaction

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
