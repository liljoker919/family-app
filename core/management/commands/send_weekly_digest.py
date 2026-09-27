import logging

from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string
from django.urls import reverse

from core.dashboard_data import _attention_items
from core.models import FamilyAccount

logger = logging.getLogger(__name__)

_SITE_URL = "https://heyfamlyapp.com"


class Command(BaseCommand):
    help = (
        "Sends the weekly digest email (overdue tasks, upcoming maintenance/registration) "
        "to every FamilyAccount owner who has email_weekly_digest enabled and has at least "
        "one attention item (#384). Intended to run weekly via cron — see deploy/."
    )

    def handle(self, *args, **options):
        sent, skipped = 0, 0
        for account in FamilyAccount.objects.filter(email_weekly_digest=True, is_active=True):
            attention_items = _attention_items(account)
            if not attention_items:
                skipped += 1
                continue

            for item in attention_items:
                item["url"] = _SITE_URL + item["url"]

            body = render_to_string("emails/weekly_digest.txt", {
                "owner_name": account.owner.first_name or account.owner.username,
                "account_name": account.name,
                "attention_items": attention_items,
                "dashboard_url": _SITE_URL + reverse("core:dashboard"),
                "profile_url": _SITE_URL + reverse("core:profile"),
            })

            try:
                send_mail(
                    subject=f"Your weekly Hey Famly digest — {len(attention_items)} item(s) need attention",
                    message=body,
                    from_email=None,
                    recipient_list=[account.email],
                )
                sent += 1
            except Exception:
                # A transient SES/network failure on one account must never
                # stop the digest going out to everyone else.
                logger.exception("Failed to send weekly digest for account %s", account.pk)

        self.stdout.write(self.style.SUCCESS(f"Weekly digest: sent {sent}, skipped {skipped} (nothing to report)."))
