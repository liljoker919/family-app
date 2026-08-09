from django.shortcuts import redirect

from .models import FamilyMembership


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.account = None
        if request.user.is_authenticated:
            membership = (
                FamilyMembership.objects
                .filter(user=request.user)
                .select_related("account")
                .first()
            )
            if membership:
                request.account = membership.account
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
            and request.account is not None
            and request.account.onboarding_complete
            and not request.path.startswith(self.EXEMPT_PATH_PREFIXES)
        ):
            verification = getattr(request.user, "email_verification", None)
            if verification is not None and not verification.verified:
                return redirect("core:verify_email_pending")
        return self.get_response(request)
