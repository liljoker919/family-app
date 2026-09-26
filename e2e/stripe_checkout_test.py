"""#375 — Free -> Family upgrade through Stripe's real test-mode Checkout
(not mocked): the multi-page redirect (app -> Stripe-hosted checkout -> back
to app) is exactly what a unit test can't catch.

Requires STRIPE_TEST_SECRET_KEY/STRIPE_TEST_PUBLIC_KEY/STRIPE_FAMILY_PRICE_ID
(same pattern core.views._create_family_checkout_session already uses, and
the same env vars OnboardingPlanViewTestCase's Stripe-touching tests expect)
— stays inert and skips, like billing itself, until they're configured as CI
secrets. Not wired into e2e.yml's PR-blocking path (#376): this hits a real
external service, so it runs on the weekly schedule only.

Webhook delivery has no publicly-routable target to reach in CI (GitHub-hosted
runners aren't), so instead of standing up Stripe CLI's `stripe listen
--forward-to`, this pulls the real `customer.subscription.created` event
Checkout produced straight from the Stripe API and feeds it through
djstripe's own `Event.process()` — the same sync + signal-dispatch a live
webhook delivery would have triggered, without needing one.
"""

import pytest
from django.conf import settings
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db

PASSWORD = "SuperSecret123!"

STRIPE_CONFIGURED = bool(settings.STRIPE_TEST_SECRET_KEY and settings.STRIPE_FAMILY_PRICE_ID)


@pytest.mark.skipif(
    not STRIPE_CONFIGURED,
    reason=(
        "STRIPE_TEST_SECRET_KEY/STRIPE_FAMILY_PRICE_ID not set — Family-plan "
        "checkout stays inert without them (core.views._create_family_checkout_session)"
    ),
)
def test_family_tier_upgrade_via_stripe_checkout(live_server, page):
    import stripe  # noqa: PLC0415
    from djstripe.models import Customer  # noqa: PLC0415
    from djstripe.models import Event as DjstripeEvent  # noqa: PLC0415

    from core.models import FamilyAccount  # noqa: PLC0415

    stripe.api_key = settings.STRIPE_TEST_SECRET_KEY

    # Sign up + skip the invite step, same as #373, to reach the plan step
    # with a real onboarding-owned account (Stripe Checkout needs a real
    # dj-stripe Customer tied to one, created lazily by
    # _create_family_checkout_session).
    page.goto(f"{live_server.url}/onboarding/signup/")
    page.fill("#id_family_name", "Stripe Test Family")
    page.fill("#id_username", "e2e_stripe_user")
    page.fill("#id_email", "e2e_stripe_user@example.com")
    page.fill("#id_password1", PASSWORD)
    page.fill("#id_password2", PASSWORD)
    page.get_by_role("button", name="Create my family's account").click()
    page.wait_for_url("**/onboarding/invite/")
    page.get_by_role("link", name="Continue").click()
    page.wait_for_url("**/onboarding/plan/")

    page.get_by_role("button", name="Subscribe — $4.99/mo").click()
    page.wait_for_url("https://checkout.stripe.com/**", timeout=30000)

    # Stripe's hosted test-mode Checkout page — documented always-succeeds
    # test card (https://stripe.com/docs/testing#cards). Selectors are
    # Stripe's own public Checkout page, addressed by label/placeholder
    # rather than guessed element IDs since Stripe owns and can change that
    # markup independently of this app.
    page.get_by_label("Email").fill("e2e_stripe_user@example.com")
    page.get_by_placeholder("1234 1234 1234 1234").fill("4242424242424242")
    page.get_by_placeholder("MM / YY").fill("12/34")
    page.get_by_placeholder("CVC").fill("123")
    cardholder_name = page.get_by_label("Cardholder name")
    if cardholder_name.count():
        cardholder_name.fill("E2E Test")
    page.get_by_test_id("hosted-payment-submit-button").click()

    # Back on the app — the Checkout session's success_url is onboarding_complete.
    page.wait_for_url(f"{live_server.url}/**", timeout=30000)

    account = FamilyAccount.objects.get(name="Stripe Test Family")
    customer = Customer.objects.get(subscriber_id=account.pk)

    subscription_created = next(
        e
        for e in stripe.Event.list(type="customer.subscription.created", limit=10).auto_paging_iter()
        if e["data"]["object"]["customer"] == customer.id
    )
    DjstripeEvent.process(subscription_created)

    account.refresh_from_db()
    assert account.tier == FamilyAccount.TIER_FAMILY

    # Previously Family-tier-gated modules (#308) are now reachable.
    page.goto(f"{live_server.url}/vehicles/")
    expect(page).to_have_title("Vehicles — Hey Famly")
