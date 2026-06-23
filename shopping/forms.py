from django import forms

from .models import ShoppingItem

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm "
    "shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_SELECT = (
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm "
    "shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class ShoppingItemForm(forms.ModelForm):
    class Meta:
        model = ShoppingItem
        fields = ["name", "quantity", "unit", "category"]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Chicken breast"}),
            "quantity": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. 2, 1/2, a handful"}),
            "unit": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. lbs, cups, oz"}),
            "category": forms.Select(attrs={"class": _SELECT}),
        }
