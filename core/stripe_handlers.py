import logging

from django.core.mail import send_mail
from djstripe.event_handlers import djstripe_receiver
from djstripe.models import Customer

logger = logging.getLogger(__name__)


def _account_for_stripe_customer(stripe_customer_id):
    if not stripe_customer_id:
        return None
    try:
        customer = Customer.objects.get(id=stripe_customer_id)
    except Customer.DoesNotExist:
        logger.warning("Webhook referenced unknown Stripe customer %s", stripe_customer_id)
        return None
    return customer.subscriber


def _send_subscription_activated_email(account):
    """#381 — handle_subscription_created previously flipped the tier with no
    confirmation/receipt sent at all. Same try/except-and-log pattern as
    handle_payment_failed: a transient SES failure must never break webhook
    processing or trigger Stripe retries."""
    try:
        send_mail(
            subject="You're on the Hey Famly Family plan!",
            message=(
                f"Hi {account.owner.first_name or account.owner.username},\n\n"
                f"Your {account.name} account is now on the Family plan ($4.99/mo) — "
                "vehicles, home maintenance, calendar sync, recipes, and vacations "
                "are all unlocked, with unlimited family members.\n\n"
                "You can view invoices or manage your subscription anytime from "
                "your Profile page.\n\n"
                "— Hey Famly"
            ),
            from_email=None,
            recipient_list=[account.email],
        )
    except Exception:
        logger.exception("Failed to send subscription-activated email for account %s", account.pk)


def _send_subscription_canceled_email(account):
    """#382 — same pattern as handle_payment_failed; must never break webhook
    processing or trigger Stripe retries."""
    try:
        send_mail(
            subject="Your Hey Famly Family plan has ended",
            message=(
                f"Hi {account.owner.first_name or account.owner.username},\n\n"
                f"Your {account.name} account's Family plan subscription has ended, "
                "and the account is now back on the Free plan. Vehicles, home "
                "maintenance, calendar sync, recipes, and vacations are no longer "
                "accessible, but Tasks and the Shopping List still are.\n\n"
                "You can resubscribe anytime from your Profile page.\n\n"
                "— Hey Famly"
            ),
            from_email=None,
            recipient_list=[account.email],
        )
    except Exception:
        logger.exception("Failed to send subscription-canceled email for account %s", account.pk)


@djstripe_receiver(["customer.subscription.created"])
def handle_subscription_created(sender, event, **kwargs):
    stripe_customer_id = event.data.get("object", {}).get("customer")
    account = _account_for_stripe_customer(stripe_customer_id)
    if account is None:
        return
    update_fields = []
    if not account.is_active:
        account.is_active = True
        update_fields.append("is_active")
    if account.tier != account.TIER_FAMILY:
        account.tier = account.TIER_FAMILY
        update_fields.append("tier")
    if update_fields:
        account.save(update_fields=update_fields)
    if account.email:
        _send_subscription_activated_email(account)


@djstripe_receiver(["customer.subscription.deleted"])
def handle_subscription_deleted(sender, event, **kwargs):
    stripe_customer_id = event.data.get("object", {}).get("customer")
    account = _account_for_stripe_customer(stripe_customer_id)
    if account is None:
        return
    update_fields = []
    if account.is_active:
        account.is_active = False
        update_fields.append("is_active")
    if account.tier != account.TIER_FREE:
        account.tier = account.TIER_FREE
        update_fields.append("tier")
    if update_fields:
        account.save(update_fields=update_fields)
    if account.email:
        _send_subscription_canceled_email(account)


@djstripe_receiver(["invoice.payment_failed"])
def handle_payment_failed(sender, event, **kwargs):
    stripe_customer_id = event.data.get("object", {}).get("customer")
    account = _account_for_stripe_customer(stripe_customer_id)
    if not account or not account.email:
        return

    try:
        send_mail(
            subject="Action needed: your Hey Famly payment didn't go through",
            message=(
                f"Hi {account.owner.first_name or account.owner.username},\n\n"
                "We weren't able to process your latest payment for Hey Famly. "
                "To avoid losing access to Family-plan features on "
                f"the {account.name} account, please contact us at "
                "cnickerson@oakcitysoftwaresolutions.com and we'll help you "
                "update your payment method (this address doesn't accept replies).\n\n"
                "— Hey Famly"
            ),
            from_email=None,
            recipient_list=[account.email],
        )
    except Exception:
        # A transient SES/network failure here must never break webhook
        # processing or trigger Stripe retries.
        logger.exception("Failed to send payment-failed email for account %s", account.pk)
