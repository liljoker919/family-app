"""#373 — the signup -> onboarding -> dashboard path: the first thing every
new customer experiences, and the most complex multi-step flow in the app
(account creation, invite step, plan selection, email verification gate).
Real Django TestCases already cover each view in isolation; this exercises
the actual multi-page browser flow those can't: redirects, session/cookie
behavior, and the real signup form's client-rendered validation UX.
"""

import re

import pytest
from django.core import mail
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db

PASSWORD = "SuperSecret123!"


def _fill_signup_form(page, *, username, email, family_name="Nickerson Family"):
    page.fill("#id_family_name", family_name)
    page.fill("#id_username", username)
    page.fill("#id_email", email)
    page.fill("#id_password1", PASSWORD)
    page.fill("#id_password2", PASSWORD)


def _extract_verification_link(message):
    match = re.search(r"https?://\S+/verify-email/\S+/", message.body)
    assert match, f"No verification link found in email body:\n{message.body}"
    return match.group(0)


def test_signup_onboarding_and_first_login(live_server, page):
    from core.models import FamilyAccount  # noqa: PLC0415

    # Landing page -> "Start Free" -> signup form.
    page.goto(live_server.url)
    page.get_by_role("link", name="Start Free").first.click()
    page.wait_for_url("**/onboarding/signup/")

    _fill_signup_form(page, username="e2e_signup_user", email="e2e_signup_user@example.com")
    page.get_by_role("button", name="Create my family's account").click()

    # Account created + logged in -> onboarding step 2 (invite, skipped here).
    page.wait_for_url("**/onboarding/invite/")
    page.get_by_role("link", name="Continue").click()

    # Onboarding step 3 (plan) -> stay on Free.
    page.wait_for_url("**/onboarding/plan/")
    page.get_by_role("button", name=re.compile("Skip for now")).click()

    # Onboarding is complete, but the real signup flow (unlike Django
    # TestCase setUp helpers that create accounts directly) creates an
    # EmailVerification row and gates the dashboard until it's confirmed
    # (core.middleware.EmailVerificationMiddleware, #377) — follow the real
    # link from the real email rather than special-casing it away.
    page.wait_for_url("**/verify-email/")
    expect(page.get_by_text("Check your email")).to_be_visible()

    # Completing onboarding also fires the separate "Welcome to Hey Famly!"
    # email (#378) — pull out the verification one specifically.
    verify_messages = [m for m in mail.outbox if m.subject == "Verify your email — Hey Famly"]
    assert len(verify_messages) == 1
    assert verify_messages[0].to == ["e2e_signup_user@example.com"]
    page.goto(_extract_verification_link(verify_messages[0]))

    page.wait_for_url("**/dashboard/")
    expect(page).to_have_title("Dashboard — Hey Famly")

    account = FamilyAccount.objects.get(name="Nickerson Family")
    assert account.onboarding_complete
    assert account.tier == FamilyAccount.TIER_FREE

    # Log out, log back in with the same credentials -> dashboard again.
    page.get_by_role("button", name="Sign out").click()
    page.wait_for_url("**/accounts/login/**")

    page.fill("#id_username", "e2e_signup_user")
    page.fill("#id_password", PASSWORD)
    page.get_by_role("button", name="Sign in").click()

    page.wait_for_url("**/dashboard/")
    expect(page).to_have_title("Dashboard — Hey Famly")


def test_signup_with_duplicate_email_shows_inline_error_and_no_second_account(live_server, page):
    from django.contrib.auth import get_user_model  # noqa: PLC0415

    User = get_user_model()

    page.goto(f"{live_server.url}/onboarding/signup/")
    _fill_signup_form(page, username="dup_user_one", email="dup_user@example.com")
    page.get_by_role("button", name="Create my family's account").click()
    page.wait_for_url("**/onboarding/invite/")

    page.get_by_role("button", name="Sign out").click()
    page.wait_for_url("**/accounts/login/**")

    page.goto(f"{live_server.url}/onboarding/signup/")
    _fill_signup_form(page, username="dup_user_two", email="dup_user@example.com")
    page.get_by_role("button", name="Create my family's account").click()

    # Stays on the signup form with the field-level error — no redirect.
    expect(page).to_have_url(f"{live_server.url}/onboarding/signup/")
    expect(page.get_by_text("An account with that email already exists.")).to_be_visible()
    assert User.objects.filter(email__iexact="dup_user@example.com").count() == 1
