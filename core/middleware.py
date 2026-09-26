from django.shortcuts import redirect
from django.urls import Resolver404, resolve

from .models import FamilyMembership


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.account = None
        # #405 — stashed alongside account so StudentAccessMiddleware (and
        # anything else keyed off role) doesn't need a second membership
        # query; this is the same row TenantMiddleware already fetched.
        request.membership_role = None
        if request.user.is_authenticated:
            membership = (
                FamilyMembership.objects
                .filter(user=request.user)
                .select_related("account")
                .first()
            )
            if membership:
                request.account = membership.account
                request.membership_role = membership.role
        return self.get_response(request)


class StudentAccessMiddleware:
    """#405 — a student-role user can only reach their own agenda, the
    school assignment views, and the calendar (read-only); everything else
    (other apps, the parent-only Student/Course pages, admin, profile,
    invites, calendar create/edit/delete) redirects to their agenda instead
    of leaking parent-only data or actions. Keyed off view name rather than
    raw path prefixes so it isn't fooled by how a URL happens to be spelled.

    Runs after TenantMiddleware (needs request.membership_role) and before
    EmailVerificationMiddleware — a student never has an EmailVerification
    row (see #377/GiveAccessView), so ordering relative to it doesn't
    actually matter, but keeping tenant-derived checks together reads better.
    """

    ALLOWED_VIEW_NAMES = {
        "logout",
        "school:my_agenda",
        "school:agenda_change_status",
        "school:assignment_detail",
        "school:assignment_create",
        "school:assignment_update",
        "school:assignment_delete",
        "calendar_events:calendar",
        "calendar_events:events_json",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.membership_role == "student" and not self._is_allowed(request):
            return redirect("school:my_agenda")
        return self.get_response(request)

    def _is_allowed(self, request):
        try:
            match = resolve(request.path_info)
        except Resolver404:
            return False
        view_name = f"{match.namespace}:{match.url_name}" if match.namespace else match.url_name
        return view_name in self.ALLOWED_VIEW_NAMES


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
