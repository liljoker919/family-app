from django import forms

from .models import Course, Student

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)
_CHECKBOX_ROW = "flex flex-wrap gap-4 mt-2"
_CHECKBOX_LABEL = "flex items-center gap-1.5 text-sm text-gray-700"


class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ["name", "school_name", "grade_level"]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Maya"}),
            "school_name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Lincoln High School"}),
            "grade_level": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. 10th Grade"}),
        }


class CourseForm(forms.ModelForm):
    meeting_days = forms.MultipleChoiceField(
        choices=Course.MEETING_DAY_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False,
    )

    class Meta:
        model = Course
        fields = [
            "name", "color", "instructor", "room",
            "meeting_days", "start_time", "end_time", "term",
        ]
        widgets = {
            "name": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. AP Chemistry"}),
            "color": forms.TextInput(attrs={"class": _INPUT, "type": "color"}),
            "instructor": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Ms. Rivera"}),
            "room": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Room 204"}),
            "start_time": forms.TimeInput(attrs={"class": _INPUT, "type": "time"}),
            "end_time": forms.TimeInput(attrs={"class": _INPUT, "type": "time"}),
            "term": forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. Fall 2026"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["meeting_days"].initial = self.instance.meeting_days
