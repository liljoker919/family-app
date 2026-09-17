"""Shared, framework-agnostic helpers for the Playwright E2E suite.

Kept separate from conftest.py so test modules can import them directly
(e.g. to build a second account mid-test) without going through fixtures.
"""

from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore

DEFAULT_PASSWORD = "SuperSecret123!"

User = get_user_model()


def create_account(tier="free", username="e2e_user", onboarding_complete=True, password=DEFAULT_PASSWORD):
    """Creates a User + FamilyAccount + owner FamilyMembership directly via
    the ORM — for tests that need a pre-provisioned account (e.g. a
    Family-tier account to reach gated modules) without exercising the real
    signup UI, which is covered separately in test_signup_onboarding.py.

    No EmailVerification row is created: absence of one is treated as
    "verified" everywhere the app checks (see core/models.EmailVerification),
    the same as an invited member.
    """
    from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

    user = User.objects.create_user(username=username, email=f"{username}@example.com", password=password)
    account = FamilyAccount.objects.create(
        name=f"{username.title()} Family",
        slug=FamilyAccount.generate_unique_slug(f"{username} family"),
        owner=user,
        tier=tier,
        onboarding_complete=onboarding_complete,
    )
    FamilyMembership.objects.create(account=account, user=user, role="owner")
    return user, account


def login_as(context, live_server, user, backend="django.contrib.auth.backends.ModelBackend"):
    """Pre-authenticates a Playwright BrowserContext as `user` by writing a
    real Django session row and handing the browser its session cookie —
    equivalent to Django test Client.force_login(), but for a real browser
    talking to the live server over HTTP.
    """
    session = SessionStore()
    session[SESSION_KEY] = str(user.pk)
    session[BACKEND_SESSION_KEY] = backend
    session[HASH_SESSION_KEY] = user.get_session_auth_hash()
    session.save()
    context.add_cookies([
        {
            "name": settings.SESSION_COOKIE_NAME,
            "value": session.session_key,
            "url": live_server.url,
        },
    ])
