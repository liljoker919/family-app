import logging

from django.contrib.auth import get_user_model
from django.dispatch import receiver
from invitations.signals import invite_accepted

from .models import FamilyMembership

logger = logging.getLogger(__name__)
User = get_user_model()


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

    FamilyMembership.objects.get_or_create(
        account=inviter_membership.account, user=user, defaults={"role": "member"},
    )
