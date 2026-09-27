from django.shortcuts import redirect
from django.urls import Resolver404, resolve
from django.utils.functional import SimpleLazyObject

from .models import FamilyMembership


class TenantMiddleware:
    """Resolves request.account (and request.membership_role, #405) lazily
    (#331) — the FamilyMembership query only runs the first time either is
    actually accessed, instead of on every authenticated request regardless
    of whether the view touches them. Both share one memoized lookup so
    touching both still costs a single query.

    `request.account` is a SimpleLazyObject, so identity checks against it
    (`is None`/`is not None`) never behave as expected — Python's `is` can't
    be intercepted by a proxy, so a lazy object wrapping None is never
    literally None. Every such check across the codebase uses truthiness
    (`not request.account` / `if request.account:`) instead, which correctly
    routes through the proxy's forwarded __bool__. `request.membership_role`
    is a plain string (or None) once resolved, so it's compared with
    `==`/`!=` everywhere rather than needing the same care — but it's still
    wrapped lazily here so accessing it alone doesn't force the query either."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        membership_cache = {}

        def get_membership():
            if "value" not in membership_cache:
                membership_cache["value"] = (
                    FamilyMembership.objects.filter(user=request.user).select_related("account").first()
                    if request.user.is_authenticated else None
                )
            return membership_cache["value"]

        def get_account():
            membership = get_membership()
            return membership.account if membership else None

        def get_role():
            membership = get_membership()
            return membership.role if membership else None

        request.account = SimpleLazyObject(get_account)
        request.membership_role = SimpleLazyObject(get_role)
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
            and request.account
            and request.account.onboarding_complete
            and not request.path.startswith(self.EXEMPT_PATH_PREFIXES)
        ):
            verification = getattr(request.user, "email_verification", None)
            if verification is not None and not verification.verified:
                return redirect("core:verify_email_pending")
        return self.get_response(request)
