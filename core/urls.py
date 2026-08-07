from django.urls import path

from .views import (
    AccountDeleteView,
    DashboardView,
    DataExportView,
    InviteMembersView,
    LandingPageView,
    OnboardingCompleteView,
    OnboardingInviteView,
    OnboardingPlanView,
    OnboardingRedirectView,
    OnboardingSignupView,
    PrivacyPolicyView,
    ProfileView,
    RobotsTxtView,
    SendInviteView,
    SitemapXmlView,
    TermsOfServiceView,
    UpgradeRequiredView,
    UpgradeToFamilyView,
)

app_name = "core"

urlpatterns = [
    path("", LandingPageView.as_view(), name="landing"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("upgrade/", UpgradeRequiredView.as_view(), name="upgrade_required"),
    path("upgrade/start/", UpgradeToFamilyView.as_view(), name="upgrade_start"),
    path("onboarding/", OnboardingRedirectView.as_view(), name="onboarding"),
    path("onboarding/signup/", OnboardingSignupView.as_view(), name="onboarding_signup"),
    path("onboarding/invite/", OnboardingInviteView.as_view(), name="onboarding_invite"),
    path("onboarding/plan/", OnboardingPlanView.as_view(), name="onboarding_plan"),
    path("onboarding/complete/", OnboardingCompleteView.as_view(), name="onboarding_complete"),
    path("invite/", InviteMembersView.as_view(), name="invite_members"),
    path("invite/send/", SendInviteView.as_view(), name="send_invite"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/export/", DataExportView.as_view(), name="data_export"),
    path("profile/delete/", AccountDeleteView.as_view(), name="account_delete"),
    path("privacy/", PrivacyPolicyView.as_view(), name="privacy_policy"),
    path("terms/", TermsOfServiceView.as_view(), name="terms_of_service"),
    path("robots.txt", RobotsTxtView.as_view(), name="robots_txt"),
    path("sitemap.xml", SitemapXmlView.as_view(), name="sitemap_xml"),
]
