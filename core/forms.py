from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()

_INPUT = (
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm "
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
)


class SignupForm(forms.Form):
    family_name = forms.CharField(
        max_length=255,
        label="Family name",
        widget=forms.TextInput(attrs={"class": _INPUT, "placeholder": "e.g. The Smiths"}),
    )
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={"class": _INPUT, "placeholder": "Choose a username"}),
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={"class": _INPUT, "placeholder": "you@example.com"}),
    )
    password1 = forms.CharField(
        label="Password",
        widget=forms.PasswordInput(attrs={"class": _INPUT}),
    )
    password2 = forms.CharField(
        label="Confirm password",
        widget=forms.PasswordInput(attrs={"class": _INPUT}),
    )

    def clean_username(self):
        username = self.cleaned_data["username"]
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError("That username is already taken.")
        return username

    def clean_email(self):
        email = self.cleaned_data["email"]
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("An account with that email already exists.")
        return email

    def clean(self):
        cleaned = super().clean()
        password1 = cleaned.get("password1")
        password2 = cleaned.get("password2")
        if password1 and password2 and password1 != password2:
            self.add_error("password2", "Passwords don't match.")
        if password1:
            try:
                validate_password(password1)
            except ValidationError as exc:
                self.add_error("password1", exc)
        return cleaned
