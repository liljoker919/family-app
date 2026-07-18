import logging
from datetime import date, datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.generic import TemplateView
from django_ratelimit.decorators import ratelimit

from .forms import SignupForm
from .models import FamilyAccount, FamilyMembership

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
    """

    template_name = "core/onboarding_signup.html"

    def get(self, request):
        if request.user.is_authenticated:
            return redirect("core:onboarding")
        return render(request, self.template_name, {"form": SignupForm()})

    def post(self, request):
        if request.user.is_authenticated:
            return redirect("core:onboarding")

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


class OnboardingInviteView(LoginRequiredMixin, TemplateView):
    """Step 2 (stub): real invite form lands with #310 + SES (#311)."""

    template_name = "core/onboarding_invite.html"

    def get(self, request, *args, **kwargs):
        if request.account is None:
            return redirect("core:dashboard")
        if request.account.onboarding_complete:
            return redirect("core:dashboard")
        return super().get(request, *args, **kwargs)


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
            messages.success(request, f"Welcome to Famly App, {account.name}!")
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
        messages.success(request, "Welcome to Famly App! Your subscription is being activated.")
        return redirect("core:dashboard")


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "core/dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self._build_summary())
        return context

    def _build_summary(self):
        summary = {
            "vehicle_count": 0,
            "next_service_due": None,
            "property_count": 0,
            "upcoming_event_count": 0,
        }

        account = self.request.account
        if account is None:
            # account is nullable until a later migration makes it required —
            # querying account=None below would match legacy/orphaned rows.
            return summary

        try:
            from vehicles.models import Vehicle, VehicleService  # noqa: PLC0415
            summary["vehicle_count"] = Vehicle.objects.filter(account=account).count()
            summary["next_service_due"] = (
                VehicleService.objects.filter(vehicle__account=account, date__gte=date.today())
                .order_by("date")
                .select_related("vehicle")
                .first()
            )
        except Exception:
            pass

        try:
            from property.models import Property  # noqa: PLC0415
            summary["property_count"] = Property.objects.filter(account=account).count()
        except Exception:
            pass

        try:
            from django.utils import timezone as tz  # noqa: PLC0415
            from calendar_events.views import collect_events  # noqa: PLC0415
            start_dt = tz.make_aware(datetime.combine(date.today(), datetime.min.time()))
            end_dt = start_dt + timedelta(days=7)
            summary["upcoming_event_count"] = len(collect_events(account, start_dt, end_dt))
        except Exception:
            pass

        return summary
