from django.conf import settings
from django.db import models


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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    @property
    def email(self):
        # dj-stripe's Customer.get_or_create() requires the subscriber model
        # to have an email — the owner's is the natural choice here.
        return self.owner.email


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
