import logging

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.dispatch import receiver
from invitations.signals import invite_accepted

from .models import FamilyMembership

logger = logging.getLogger(__name__)
User = get_user_model()


def _send_family_join_notification(account, new_member):
    """#383 — notifies the account owner, since they're the one who'd want to
    know their family grew (the invite-sent email already exists via
    django-invitations; this covers the silent accept side)."""
    if not account.owner.email:
        return
    try:
        send_mail(
            subject=f"{new_member.first_name or new_member.username} joined {account.name}",
            message=(
                f"Hi {account.owner.first_name or account.owner.username},\n\n"
                f"{new_member.first_name or new_member.username} ({new_member.email}) just "
                f"accepted your invite and joined the {account.name} account.\n\n"
                "— Hey Famly"
            ),
            from_email=None,
            recipient_list=[account.owner.email],
        )
    except Exception:
        logger.exception("Failed to send family-join notification for account %s", account.pk)


@receiver(invite_accepted)
def handle_invite_accepted(sender, email, invitation, request=None, **kwargs):
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        logger.warning("invite_accepted fired for %s but no matching user exists", email)
        return

    inviter_membership = (
        FamilyMembership.objects.filter(user=invitation.inviter).select_related("account").first()
    )
    if inviter_membership is None:
        logger.warning("invite_accepted: inviter %s has no FamilyMembership", invitation.inviter_id)
        return

    _, created = FamilyMembership.objects.get_or_create(
        account=inviter_membership.account, user=user, defaults={"role": "member"},
    )
    if created:
        _send_family_join_notification(inviter_membership.account, user)
