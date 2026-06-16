from django import forms

from .models import Vehicle, VehicleService

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


class VehicleForm(forms.ModelForm):
    class Meta:
        model = Vehicle
        fields = [
            "year", "make", "model", "vin",
            "color", "license_plate", "current_mileage", "registration_expiry",
        ]
        widgets = {
            "year": forms.NumberInput(attrs={"class": _INPUT, "placeholder": "e.g. 2022", "min": 1900, "max": 2100}),
            "make": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Toyota"}),
            "model": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Camry"}),
            "vin": forms.TextInput(attrs={"class": _INPUT, "placeholder": "17-character VIN", "maxlength": "17", "style": "font-family: monospace;"}),
            "color": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Silver"}),
            "license_plate": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. ABC-1234"}),
            "current_mileage": forms.NumberInput(attrs={"class": _INPUT, "min": 0}),
            "registration_expiry": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
        }


class VehicleServiceForm(forms.ModelForm):
    class Meta:
        model = VehicleService
        fields = ["service_type", "description", "date", "mileage_at_service", "cost", "provider"]
        widgets = {
            "service_type": forms.Select(attrs={"class": _SELECT}),
            "description": forms.Textarea(attrs={"class": _TEXTAREA, "rows": 3, "placeholder": "Additional notes…"}),
            "date": forms.DateInput(attrs={"class": _INPUT, "type": "date"}),
            "mileage_at_service": forms.NumberInput(attrs={"class": _INPUT, "min": 0}),
            "cost": forms.NumberInput(attrs={"class": _INPUT, "step": "0.01", "min": "0", "placeholder": "0.00"}),
            "provider": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Jiffy Lube"}),
        }
