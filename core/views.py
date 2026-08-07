import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView
from django.contrib.auth.views import PasswordChangeView as DjangoPasswordChangeView
from django.contrib import messages
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.generic import TemplateView
from django_ratelimit.decorators import ratelimit
from invitations.forms import InviteForm
from invitations.utils import get_invitation_model

from .dashboard_data import build_dashboard_context
from .data_export import build_export_zip
from .forms import AccountDeleteConfirmForm, InvitedSignupForm, PasswordChangeForm, ProfileForm, SignupForm
from .invitations_adapter import user_signed_up
from .models import FamilyAccount, FamilyMembership

Invitation = get_invitation_model()

logger = logging.getLogger(__name__)
User = get_user_model()


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="dispatch")
class RateLimitedLoginView(LoginView):
    pass


class UpgradeRequiredView(LoginRequiredMixin, TemplateView):
    template_name = "core/upgrade_required.html"


# ── Onboarding ────────────────────────────────────────────────────────────

class OnboardingRedirectView(View):
    """Bare /onboarding/ routes to wherever the visitor actually belongs."""

    def get(self, request):
        if not request.user.is_authenticated:
            return redirect("core:onboarding_signup")
        account = request.account
        if account is None or account.onboarding_complete:
            return redirect("core:dashboard")
        return redirect("core:onboarding_invite")


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="dispatch")
class OnboardingSignupView(View):
    """Step 1: create the User + FamilyAccount + owner FamilyMembership.

    The only entry point in the app that creates an account at all — no
    other registration flow exists yet (#309).

    Also doubles as the landing page for invite links (#310): django-invitations
    redirects here (INVITATIONS_SIGNUP_REDIRECT) after stashing a verified
    email in the session, so this branches into a simpler "join" form with no
    family_name field — they're joining an existing account, not creating one.
    """

    template_name = "core/onboarding_signup.html"
    invited_template_name = "core/onboarding_signup_invited.html"

    def get(self, request):
        if request.user.is_authenticated:
            return redirect("core:onboarding")
        invited_email = request.session.get("account_verified_email")
        if invited_email:
            return render(request, self.invited_template_name, {"form": InvitedSignupForm(), "email": invited_email})
        return render(request, self.template_name, {"form": SignupForm()})

    def post(self, request):
        if request.user.is_authenticated:
            return redirect("core:onboarding")
        invited_email = request.session.get("account_verified_email")
        if invited_email:
            return self._post_invited(request, invited_email)
        return self._post_fresh(request)

    def _post_fresh(self, request):
        form = SignupForm(request.POST)
        if not form.is_valid():
            return render(request, self.template_name, {"form": form})

        data = form.cleaned_data
        user = User.objects.create_user(
            username=data["username"], email=data["email"], password=data["password1"],
        )
        account = FamilyAccount.objects.create(
            name=data["family_name"],
            slug=FamilyAccount.generate_unique_slug(data["family_name"]),
            owner=user,
        )
        FamilyMembership.objects.create(account=account, user=user, role="owner")

        login(request, user)
        return redirect("core:onboarding_invite")

    def _post_invited(self, request, invited_email):
        form = InvitedSignupForm(request.POST)
        if not form.is_valid():
            return render(request, self.invited_template_name, {"form": form, "email": invited_email})

        if User.objects.filter(email__iexact=invited_email).exists():
            # Shouldn't normally happen (InviteForm blocks inviting an email
            # that's already a registered user), but don't 500 on the race.
            messages.error(request, "An account with that email already exists — sign in instead.")
            return redirect("login")

        data = form.cleaned_data
        user = User.objects.create_user(
            username=data["username"], email=invited_email, password=data["password1"],
        )

        # Fires invitations' accept_invite_after_signup handler (connected via
        # our custom adapter, see core/invitations_adapter.py), which marks
        # the Invitation accepted and fires invite_accepted — handled in
        # core/invitation_handlers.py to create the FamilyMembership.
        user_signed_up.send(sender=User, request=request, user=user)
        request.session.pop("account_verified_email", None)

        login(request, user)
        messages.success(request, "Welcome! You've joined the family.")
        return redirect("core:dashboard")


class OnboardingInviteView(LoginRequiredMixin, TemplateView):
    """Step 2: real invite form (#310), posts to SendInviteView."""

    template_name = "core/onboarding_invite.html"

    def get(self, request, *args, **kwargs):
        if request.account is None:
            return redirect("core:dashboard")
        if request.account.onboarding_complete:
            return redirect("core:dashboard")
        return super().get(request, *args, **kwargs)


def _pending_invites_for(account):
    member_user_ids = FamilyMembership.objects.filter(account=account).values("user")
    return Invitation.objects.all_valid().filter(inviter__in=member_user_ids)


class SendInviteView(LoginRequiredMixin, View):
    """Rate-limited, Free-tier-capped wrapper around django-invitations'
    InviteForm — the only supported way to send an invite (#310). The
    package's own send-invite/send-json-invite URLs aren't wired at all
    (see family_project/urls.py)."""

    @method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True))
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request):
        account = request.account
        redirect_to = (
            "core:onboarding_invite" if account and not account.onboarding_complete else "core:invite_members"
        )

        if account is None:
            messages.error(request, "No active family account found.")
            return redirect(redirect_to)

        if account.tier == FamilyAccount.TIER_FREE:
            member_count = FamilyMembership.objects.filter(account=account).count()
            pending_count = _pending_invites_for(account).count()
            if member_count + pending_count >= 2:
                messages.error(
                    request,
                    "The Free plan is capped at 2 members. Upgrade to Family for unlimited members.",
                )
                return redirect(redirect_to)

        form = InviteForm(request.POST)
        if not form.is_valid():
            error = next(iter(form.errors.get("email", [])), "Couldn't send that invite.")
            messages.error(request, error)
            return redirect(redirect_to)

        email = form.cleaned_data["email"]
        invite = form.save(email)
        invite.inviter = request.user
        invite.save()
        invite.send_invitation(request)
        messages.success(request, f"Invited {email}.")
        return redirect(redirect_to)


class InviteMembersView(LoginRequiredMixin, TemplateView):
    """Standalone "manage family members" page — unlike the onboarding invite
    step, this stays reachable after onboarding is complete."""

    template_name = "core/invite_members.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        account = self.request.account
        if account is not None:
            context["members"] = FamilyMembership.objects.filter(account=account).select_related("user")
            context["pending_invites"] = _pending_invites_for(account)
        else:
            context["members"] = []
            context["pending_invites"] = []
        return context


def _create_family_checkout_session(request, account):
    """Returns a Stripe Checkout URL for the Family plan, or None if billing
    isn't configured yet (no Price ID / no API key) — mirrors the inert-until-
    configured pattern used everywhere else Stripe is touched (#307)."""

    price_id = getattr(settings, "STRIPE_FAMILY_PRICE_ID", "")
    if not price_id:
        logger.warning("Family plan checkout attempted with no STRIPE_FAMILY_PRICE_ID configured")
        return None

    live_mode = getattr(settings, "STRIPE_LIVE_MODE", False)
    secret_key = getattr(settings, "STRIPE_LIVE_SECRET_KEY", "") if live_mode else getattr(settings, "STRIPE_TEST_SECRET_KEY", "")
    if not secret_key:
        logger.warning("Family plan checkout attempted with no Stripe secret key configured")
        return None

    import stripe  # noqa: PLC0415
    from djstripe.models import Customer  # noqa: PLC0415

    stripe.api_key = secret_key
    customer, _created = Customer.get_or_create(subscriber=account)

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer.id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=request.build_absolute_uri(reverse("core:onboarding_complete")),
        cancel_url=request.build_absolute_uri(reverse("core:onboarding_plan")),
    )
    return session.url


class OnboardingPlanView(LoginRequiredMixin, View):
    """Step 3: Free activates immediately; Family redirects to Stripe Checkout."""

    template_name = "core/onboarding_plan.html"

    def get(self, request):
        if request.account is None:
            return redirect("core:dashboard")
        if request.account.onboarding_complete:
            return redirect("core:dashboard")
        return render(request, self.template_name)

    def post(self, request):
        account = request.account
        if account is None:
            return redirect("core:dashboard")

        plan = request.POST.get("plan")

        if plan == "free":
            account.onboarding_complete = True
            account.save(update_fields=["onboarding_complete"])
            messages.success(request, f"Welcome to Hey Famly, {account.name}!")
            return redirect("core:dashboard")

        if plan == "family":
            checkout_url = _create_family_checkout_session(request, account)
            if checkout_url is None:
                messages.error(
                    request,
                    "The Family plan isn't available for checkout right now — please try again "
                    "shortly, or start on Free and upgrade later.",
                )
                return redirect("core:onboarding_plan")
            return redirect(checkout_url)

        messages.error(request, "Please choose a plan to continue.")
        return redirect("core:onboarding_plan")


class OnboardingCompleteView(LoginRequiredMixin, View):
    """Stripe Checkout success_url target — marks onboarding done. The tier
    flip to 'family' itself happens async via the subscription.created
    webhook (#308); this view doesn't need to wait for it."""

    def get(self, request):
        account = request.account
        if account is not None and not account.onboarding_complete:
            account.onboarding_complete = True
            account.save(update_fields=["onboarding_complete"])
        messages.success(request, "Welcome to Hey Famly! Your subscription is being activated.")
        return redirect("core:dashboard")


# ── Profile ───────────────────────────────────────────────────────────────

class ProfileView(LoginRequiredMixin, View):
    """Name/email edit for the logged-in user (#312). Password change is
    handled separately by Django's built-in PasswordChangeView, already
    registered via django.contrib.auth.urls — just linked from here with
    app-styled templates (templates/registration/password_change_*.html)."""

    template_name = "core/profile.html"

    def get(self, request):
        return render(request, self.template_name, {"form": ProfileForm(instance=request.user)})

    def post(self, request):
        form = ProfileForm(request.POST, instance=request.user)
        if not form.is_valid():
            return render(request, self.template_name, {"form": form})
        form.save()
        messages.success(request, "Profile updated.")
        return redirect("core:profile")


class StyledPasswordChangeView(DjangoPasswordChangeView):
    """Overrides the plain default from django.contrib.auth.urls with the
    app-styled form/template — wired ahead of that include() in
    family_project/urls.py so this wins the `password_change` URL name."""

    form_class = PasswordChangeForm
    template_name = "registration/password_change_form.html"


class DataExportView(LoginRequiredMixin, View):
    """Right to data portability (#319): account owner downloads a ZIP of
    CSVs covering every account-scoped model, built synchronously in-request."""

    def get(self, request):
        account = request.account
        if account is None or request.user != account.owner:
            messages.error(request, "Only the account owner can export account data.")
            return redirect("core:profile")

        zip_bytes = build_export_zip(account)
        filename = f"{account.slug}-data-export-{timezone.now():%Y%m%d}.zip"
        response = HttpResponse(zip_bytes, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


def _cancel_active_subscriptions(account):
    """Best-effort Stripe cleanup before deleting an account (#320) — without
    this, the customer's card would keep being charged, since deleting our
    local FamilyAccount/Customer rows has no effect on Stripe's side. Mirrors
    the inert-until-configured pattern used everywhere else Stripe is touched."""

    live_mode = getattr(settings, "STRIPE_LIVE_MODE", False)
    secret_key = getattr(settings, "STRIPE_LIVE_SECRET_KEY", "") if live_mode else getattr(settings, "STRIPE_TEST_SECRET_KEY", "")
    if not secret_key:
        return

    import stripe  # noqa: PLC0415
    from djstripe.models import Customer  # noqa: PLC0415

    stripe.api_key = secret_key
    customer = Customer.objects.filter(subscriber=account).first()
    if customer is None:
        return
    for subscription in customer.subscriptions.filter(status__in=["active", "trialing", "past_due"]):
        subscription.cancel()


class AccountDeleteView(LoginRequiredMixin, View):
    """Right-to-erasure (#320): the account owner permanently deletes their
    FamilyAccount and all cascading data. Immediate hard delete rather than a
    soft-delete + grace period — this is a household app, not one where an
    accidental-deletion recovery pipeline is worth the added complexity; the
    password re-entry is the safeguard against a stray click."""

    template_name = "core/account_delete_confirm.html"

    def get(self, request):
        account = request.account
        if account is None or request.user != account.owner:
            messages.error(request, "Only the account owner can delete the family account.")
            return redirect("core:profile")
        return render(request, self.template_name, {"form": AccountDeleteConfirmForm()})

    def post(self, request):
        account = request.account
        if account is None or request.user != account.owner:
            messages.error(request, "Only the account owner can delete the family account.")
            return redirect("core:profile")

        form = AccountDeleteConfirmForm(request.POST)
        if form.is_valid() and not request.user.check_password(form.cleaned_data["password"]):
            form.add_error("password", "Incorrect password.")

        if form.errors:
            return render(request, self.template_name, {"form": form})

        _cancel_active_subscriptions(account)
        account_name = account.name
        logout(request)
        account.delete()
        messages.success(request, f'The "{account_name}" account and all its data have been permanently deleted.')
        return redirect("core:landing")


# ── Public marketing page ────────────────────────────────────────────────

class LandingPageView(TemplateView):
    """Public, no-login-required marketing page at `/` (#315) — root used to
    go straight to the login-gated dashboard with no public page at all."""

    template_name = "core/landing.html"

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect("core:dashboard")
        return super().get(request, *args, **kwargs)


class PrivacyPolicyView(TemplateView):
    """Public legal page (#318/#321) — viewable whether logged in or not."""

    template_name = "core/privacy_policy.html"


class TermsOfServiceView(TemplateView):
    """Public legal page (#318) — viewable whether logged in or not."""

    template_name = "core/terms_of_service.html"


class RobotsTxtView(TemplateView):
    """#337 — allows crawling of the public marketing/legal pages, disallows
    the login-walled app. Plain robots.txt, not django-robots: only three
    public URLs exist, not worth a DB-backed rule editor for that."""

    template_name = "robots.txt"
    content_type = "text/plain"


class SitemapXmlView(TemplateView):
    """#337 — hand-rolled rather than django.contrib.sitemaps: that
    framework's URL/domain resolution depends on django.contrib.sites (a new
    installed app, a SITE_ID setting, and a Site row to keep in sync with
    the real domain), which is more moving parts than three static URLs
    justify."""

    template_name = "sitemap.xml"
    content_type = "application/xml"


class DashboardView(LoginRequiredMixin, TemplateView):
    """Daily command center (#325) — surfaces what's happening today, what
    needs to be done, and what needs attention, instead of bare module
    counts. See core/dashboard_data.py for the per-widget queries."""

    template_name = "core/dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(build_dashboard_context(self.request))
        return context
