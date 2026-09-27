from django.shortcuts import redirect
from django.utils.functional import SimpleLazyObject

from .models import FamilyMembership


class TenantMiddleware:
    """Resolves request.account lazily (#331) — the FamilyMembership query
    only runs the first time request.account is actually accessed, instead
    of on every authenticated request regardless of whether the view touches
    it. `request.account` is a SimpleLazyObject, so identity checks against
    it (`is None`/`is not None`) never behave as expected — Python's `is`
    can't be intercepted by a proxy, so a lazy object wrapping None is never
    literally None. Every such check across the codebase uses truthiness
    (`not request.account` / `if request.account:`) instead, which correctly
    routes through the proxy's forwarded __bool__."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        def get_account():
            if not request.user.is_authenticated:
                return None
            membership = FamilyMembership.objects.filter(user=request.user).select_related("account").first()
            return membership.account if membership else None

        request.account = SimpleLazyObject(get_account)
        return self.get_response(request)


class EmailVerificationMiddleware:
    """#377 — blocks dashboard/app access for a founder account whose email
    isn't verified yet, but only once onboarding is already complete: the
    founder signup -> invite -> plan -> complete flow itself must never be
    interrupted (friction after the "aha moment", not before it). Invited
    members never get an EmailVerification row at all (see the model), so
    they're never affected."""

    EXEMPT_PATH_PREFIXES = ("/verify-email/", "/accounts/logout/", "/admin/", "/profile/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.user.is_authenticated
            and request.account
            and request.account.onboarding_complete
            and not request.path.startswith(self.EXEMPT_PATH_PREFIXES)
        ):
            verification = getattr(request.user, "email_verification", None)
            if verification is not None and not verification.verified:
                return redirect("core:verify_email_pending")
        return self.get_response(request)
