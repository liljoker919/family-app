from django import forms

from .models import Student

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ["name", "school_name", "grade_level"]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Maya"}),
            "school_name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Lincoln High School"}),
            "grade_level": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. 10th Grade"}),
        }
