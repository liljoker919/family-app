from django.dispatch import Signal
from invitations.adapters import BaseInvitationsAdapter

# django-invitations expects this from django-allauth when
# INVITATIONS_ACCEPT_INVITE_AFTER_SIGNUP is True — this app has no allauth, so
# OnboardingSignupView fires it manually once a signup started from an invite
# link actually completes (see core/views.py).
user_signed_up = Signal()


class FamlyAppInvitationsAdapter(BaseInvitationsAdapter):
    def get_user_signed_up_signal(self):
        return user_signed_up
