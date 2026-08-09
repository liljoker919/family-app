from django.conf import settings
from django.db import models
from django.utils.text import slugify


class FamilyAccount(models.Model):
    TIER_FREE = "free"
    TIER_FAMILY = "family"
    TIER_CHOICES = [(TIER_FREE, "Free"), (TIER_FAMILY, "Family")]

    name = models.CharField(max_length=255)
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_account",
    )
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default=TIER_FREE)
    onboarding_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    @property
    def email(self):
        # dj-stripe's Customer.get_or_create() requires the subscriber model
        # to have an email — the owner's is the natural choice here.
        return self.owner.email

    @classmethod
    def generate_unique_slug(cls, name):
        base = slugify(name) or "family"
        slug = base
        suffix = 2
        while cls.objects.filter(slug=slug).exists():
            slug = f"{base}-{suffix}"
            suffix += 1
        return slug


class EmailVerification(models.Model):
    """#377 — created only for the account founder at signup (invited members
    already prove ownership of their email by clicking the invite link, so
    they never get a row here). Absence of a row for a user is treated as
    "verified" everywhere this is checked."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification",
    )
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} ({'verified' if self.verified else 'unverified'})"


class FamilyMembership(models.Model):
    ROLE_CHOICES = [("owner", "Owner"), ("member", "Member")]

    account = models.ForeignKey(FamilyAccount, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account", "user"], name="unique_account_user_membership"),
        ]

    def __str__(self):
        return f"{self.user} — {self.account} ({self.role})"
