from django.urls import path

from .views import (
    DashboardView,
    OnboardingCompleteView,
    OnboardingInviteView,
    OnboardingPlanView,
    OnboardingRedirectView,
    OnboardingSignupView,
    UpgradeRequiredView,
)

app_name = "core"

urlpatterns = [
    path("", DashboardView.as_view(), name="dashboard"),
    path("upgrade/", UpgradeRequiredView.as_view(), name="upgrade_required"),
    path("onboarding/", OnboardingRedirectView.as_view(), name="onboarding"),
    path("onboarding/signup/", OnboardingSignupView.as_view(), name="onboarding_signup"),
    path("onboarding/invite/", OnboardingInviteView.as_view(), name="onboarding_invite"),
    path("onboarding/plan/", OnboardingPlanView.as_view(), name="onboarding_plan"),
    path("onboarding/complete/", OnboardingCompleteView.as_view(), name="onboarding_complete"),
]
