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


@djstripe_receiver(["invoice.payment_failed"])
def handle_payment_failed(sender, event, **kwargs):
    stripe_customer_id = event.data.get("object", {}).get("customer")
    account = _account_for_stripe_customer(stripe_customer_id)
    if not account or not account.email:
        return

    try:
        send_mail(
            subject="Action needed: your Famly App payment didn't go through",
            message=(
                f"Hi {account.owner.first_name or account.owner.username},\n\n"
                "We weren't able to process your latest payment for Famly App. "
                "Please update your payment method to avoid losing access to "
                f"the {account.name} account.\n\n"
                "— Famly App"
            ),
            from_email=None,
            recipient_list=[account.email],
        )
    except Exception:
        # Email delivery isn't configured yet (see ticket #311) — don't let a
        # notification failure break webhook processing or trigger Stripe retries.
        logger.exception("Failed to send payment-failed email for account %s", account.pk)
