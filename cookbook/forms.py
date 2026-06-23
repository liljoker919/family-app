from django import forms

from .models import Ingredient, Recipe, RecipeStep

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_SELECT = (
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_CHECK = "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"


class RecipeForm(forms.ModelForm):
    class Meta:
        model = Recipe
        fields = [
            "title", "category", "description",
            "prep_time_minutes", "cook_time_minutes", "servings",
            "is_family_favorite", "source",
        ]
        widgets = {
            "title": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Grandma's Lasagna"}),
            "category": forms.Select(attrs={"class": _SELECT}),
            "description": forms.Textarea(attrs={"class": _INPUT, "rows": 3, "placeholder": "Brief description (optional)"}),
            "prep_time_minutes": forms.NumberInput(attrs={"class": _INPUT, "min": "0", "placeholder": "0"}),
            "cook_time_minutes": forms.NumberInput(attrs={"class": _INPUT, "min": "0", "placeholder": "0"}),
            "servings": forms.NumberInput(attrs={"class": _INPUT, "min": "1", "placeholder": "4"}),
            "is_family_favorite": forms.CheckboxInput(attrs={"class": _CHECK}),
            "source": forms.TextInput(attrs={"class": _INPUT, "placeholder": "Recipe card, website URL, cookbook name…"}),
        }


class IngredientForm(forms.ModelForm):
    class Meta:
        model = Ingredient
        fields = ["name", "quantity", "unit"]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. All-purpose flour"}),
            "quantity": forms.NumberInput(attrs={"class": _INPUT, "step": "0.25", "min": "0", "placeholder": "1.5"}),
            "unit": forms.Select(attrs={"class": _SELECT}),
        }


class RecipeStepForm(forms.ModelForm):
    class Meta:
        model = RecipeStep
        fields = ["step_number", "instruction"]
        widgets = {
            "step_number": forms.NumberInput(attrs={"class": _INPUT, "min": "1"}),
            "instruction": forms.Textarea(attrs={"class": _INPUT, "rows": 3, "placeholder": "Describe this step…"}),
        }
