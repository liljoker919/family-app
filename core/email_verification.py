import logging

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

logger = logging.getLogger(__name__)


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Subclassing (rather than reusing default_token_generator directly)
    gives this its own key_salt — Django derives it from the class's dotted
    path — so a verification link and a password-reset link for the same
    user at the same moment can never be interchangeable."""


email_verification_token = EmailVerificationTokenGenerator()


def send_verification_email(request, user):
    """#377 — best-effort only: a transient SES/network failure here must
    never break signup."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    path = reverse("core:verify_email_confirm", kwargs={"uidb64": uid, "token": token})
    verify_url = request.build_absolute_uri(path)

    try:
        send_mail(
            subject="Verify your email — Hey Famly",
            message=(
                f"Hi {user.first_name or user.username},\n\n"
                "Please confirm this is your email address by clicking the link below:\n\n"
                f"{verify_url}\n\n"
                "— Hey Famly"
            ),
            from_email=None,
            recipient_list=[user.email],
        )
    except Exception:
        logger.exception("Failed to send verification email for user %s", user.pk)
