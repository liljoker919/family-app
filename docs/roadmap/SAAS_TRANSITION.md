# SaaS Transition Roadmap

This document outlines the work required to evolve the Family App from a single-tenant private tool into a multi-tenant SaaS product. It is organized into phases so each stage can ship independently without breaking existing data or functionality.

---

## Phase 0 — Stabilize Before You Scale

Before adding any multi-tenancy complexity, the current single-tenant app needs a few protective foundations. Skipping this phase means migrating with technical debt still live.

### 0.1 Automated Database Backups

The SQLite database is the single most irreplaceable asset. Set up automated backups before anything else.

**On the Lightsail server (immediate):**
```bash
# /etc/cron.d/family-app-backup
0 3 * * * ec2-user sqlite3 /srv/family-app/db/db.sqlite3 ".backup /srv/family-app/backups/db-$(date +\%Y\%m\%d).sqlite3"
# Keep 30 days
0 4 * * * ec2-user find /srv/family-app/backups/ -name "db-*.sqlite3" -mtime +30 -delete
```

**Sync to S3 for offsite durability:**
```bash
0 5 * * * ec2-user aws s3 sync /srv/family-app/backups/ s3://your-backup-bucket/family-app-db/
```

This daily backup + S3 sync means zero data loss when switching to PostgreSQL — you restore from the final SQLite snapshot, run `pgloader` or a management command to import, then verify row counts.

### 0.2 Baseline Test Coverage

Add at minimum smoke tests for every CBV before touching models:
- One test per view asserting a 200 response for authenticated users
- One test per view asserting a 302 redirect for unauthenticated users

These become your regression net when the tenant FK is injected.

### 0.3 Error Tracking

Add Sentry before launch. One line in `requirements.txt`:
```
sentry-sdk[django]>=2.0.0
```

```python
# settings/prod.py
import sentry_sdk
sentry_sdk.init(dsn=env("SENTRY_DSN"), traces_sample_rate=0.1)
```

Without this you are blind to exceptions in production.

---

## Phase 1 — Multi-Tenancy (The Core Architecture Change)

This is the largest, riskiest phase. Everything else depends on it being done correctly.

### 1.1 The Tenant Anchor Model

Add a `FamilyAccount` to `core/models.py`. This is the paying subscriber unit — one per family.

```python
# core/models.py
class FamilyAccount(models.Model):
    name = models.CharField(max_length=255)
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_account",
    )
    slug = models.SlugField(unique=True)          # Used in subdomain or URL prefix
    is_active = models.BooleanField(default=True) # False when subscription lapses
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class FamilyMembership(models.Model):
    ROLE_CHOICES = [("owner", "Owner"), ("member", "Member")]
    account = models.ForeignKey(FamilyAccount, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("account", "user")]
```

The `FamilyMembership` join table is important — it allows multiple family members (with different Django user accounts) to share one `FamilyAccount`.

### 1.2 The Non-Breaking Migration Strategy

Never add a required FK to existing tables in a single migration. Use three separate migrations:

**Migration A — Add nullable FK to every model:**
```python
# Affects: Vehicle, Property, CalendarEvent, Vacation, Recipe,
#          ShoppingItem, FamilyTask (all core data models)
account = models.ForeignKey(
    "core.FamilyAccount",
    on_delete=models.CASCADE,
    null=True,    # Must be null to not break existing rows
    blank=True,
)
```

**Migration B — Backfill script (data migration):**
```python
def backfill_account(apps, schema_editor):
    FamilyAccount = apps.get_model("core", "FamilyAccount")
    User = apps.get_model("auth", "User")

    # Create the founding account for the existing family
    owner = User.objects.filter(is_superuser=True).first()
    account, _ = FamilyAccount.objects.get_or_create(
        owner=owner,
        defaults={"name": "My Family", "slug": "my-family"},
    )
    # Assign every orphaned row to this account
    for model_name in ["Vehicle", "Property", "CalendarEvent",
                        "Vacation", "Recipe", "ShoppingItem", "FamilyTask"]:
        Model = apps.get_model(...)
        Model.objects.filter(account__isnull=True).update(account=account)
```

**Migration C — Make FK required:**
```python
account = models.ForeignKey(
    "core.FamilyAccount",
    on_delete=models.CASCADE,
    null=False,   # Now enforced for all future rows
)
```

Run Migration A + B together in the same deploy. Wait one release cycle. Then ship Migration C.

### 1.3 Tenant Middleware

One middleware that resolves the current account on every request. All views read from `request.account` — no per-view account lookup code.

```python
# core/middleware.py
from .models import FamilyMembership

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.account = None
        if request.user.is_authenticated:
            membership = (
                FamilyMembership.objects
                .filter(user=request.user)
                .select_related("account")
                .first()
            )
            if membership:
                request.account = membership.account
        return self.get_response(request)
```

Add to `MIDDLEWARE` in `settings/base.py` after `AuthenticationMiddleware`.

### 1.4 QuerySet Isolation Pattern

Every `get_queryset()` override filters by `request.account`. Write a mixin to avoid repeating this:

```python
# core/mixins.py
class AccountScopedMixin:
    def get_queryset(self):
        return super().get_queryset().filter(account=self.request.account)
```

```python
# vehicles/views.py — before and after
# Before:
class VehicleListView(LoginRequiredMixin, ListView):
    model = Vehicle

# After:
class VehicleListView(LoginRequiredMixin, AccountScopedMixin, ListView):
    model = Vehicle
```

This is the primary change in every view file. It is mechanical but must be applied to all 30+ views. Write an automated test that asserts User B cannot see User A's records — run it against every model after each view is updated.

### 1.5 `save()` Auto-Injection

Override `form_valid()` in CreateViews to stamp the account FK:

```python
def form_valid(self, form):
    form.instance.account = self.request.account
    return super().form_valid(form)
```

---

## Phase 2 — SaaS Infrastructure

### 2.1 Stripe Billing

Use `dj-stripe` to mirror Stripe's subscription state into local models.

```
dj-stripe>=2.8.0
```

Key webhook events to handle:
- `customer.subscription.created` → set `account.is_active = True`
- `customer.subscription.deleted` → set `account.is_active = False`
- `invoice.payment_failed` → send grace period email

**Subscription gating mixin:**

```python
# core/mixins.py
from django.shortcuts import redirect

class SubscriptionRequiredMixin:
    def dispatch(self, request, *args, **kwargs):
        if request.account and not request.account.is_active:
            return redirect("core:subscription_lapsed")
        return super().dispatch(request, *args, **kwargs)
```

Apply to any view that should be paywalled (properties, cookbook, etc.). Keep the task board and shopping list free-tier to reduce friction.

**Suggested tier structure:**
| Tier | Price | Includes |
|------|-------|----------|
| Free | $0 | Tasks, Shopping List, up to 2 members |
| Family | $4.99/mo | All modules, unlimited members, calendar sync |
| Premium | $9.99/mo | All above + file attachments, data export |

### 2.2 Member Invitation System

Rather than building from scratch, use `django-invitations`:
```
django-invitations>=2.1.0
```

It provides the `Invitation` model, signed token generation, email delivery, and the accept view. You wire it to create a `FamilyMembership` on acceptance:

```python
# core/signals.py
from invitations.signals import invite_accepted

@receiver(invite_accepted)
def on_invite_accepted(sender, email, **kwargs):
    user = User.objects.get(email=email)
    account = sender.inviter.owned_account
    FamilyMembership.objects.get_or_create(user=user, account=account)
```

Custom invitation form adds `account` context so invites are scoped to the right family.

### 2.3 Transactional Email

Switch `EMAIL_BACKEND` in `settings/prod.py` to SES:

```python
EMAIL_BACKEND = "django_ses.SESBackend"
AWS_SES_REGION_NAME = "us-east-1"
DEFAULT_FROM_EMAIL = "noreply@heyfamlyapp.com"
```

Emails needed:
- Invitation email (invitation system handles this)
- Subscription confirmation
- Payment failure / grace period warning
- Data export ready (Phase 3)

### 2.4 Onboarding Flow

New accounts need a first-run wizard before they hit the dashboard:

1. **Name your family** (sets `FamilyAccount.name`)
2. **Invite members** (shows invitation form inline)
3. **Pick a plan** (Stripe Checkout redirect)
4. **Done** → redirect to dashboard with welcome message

Route: `/onboarding/` — only accessible once, redirect away if already complete. Track completion with a `FamilyAccount.onboarding_complete` BooleanField.

---

## Phase 3 — Database Migration (SQLite → PostgreSQL)

### 3.1 Why PostgreSQL for SaaS

SQLite serializes all writes through a single file lock. Under concurrent multi-family writes it will produce `database is locked` errors. PostgreSQL handles concurrent writes, row-level locking, connection pooling, and point-in-time recovery — all necessary for a shared SaaS.

### 3.2 Migration Playbook

**Step 1 — Provision RDS PostgreSQL** (do this weeks before migrating):
- AWS RDS `db.t4g.micro` is sufficient for early SaaS ($15–20/mo)
- Enable automated backups with 7-day retention
- Put it in the same VPC as the Lightsail instance

**Step 2 — Install and configure:**
```
psycopg2-binary>=2.9
```

```python
# settings/prod.py
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST"),
        "PORT": "5432",
    }
}
```

**Step 3 — Take final SQLite backup:**
```bash
sqlite3 /srv/family-app/db/db.sqlite3 ".backup /srv/family-app/backups/pre-pg-migration.sqlite3"
aws s3 cp /srv/family-app/backups/pre-pg-migration.sqlite3 s3://your-backup-bucket/
```

**Step 4 — Run migrations against PostgreSQL** (fresh schema):
```bash
python manage.py migrate --database=default
```

**Step 5 — Transfer data with `pgloader`:**
```
LOAD DATABASE
  FROM sqlite:///srv/family-app/db/db.sqlite3
  INTO postgresql://user:password@rds-host/dbname
  WITH data only, reset sequences;
```

Or use `python-dateutil` + a management command that reads from SQLite and writes to PostgreSQL using Django ORM (safer, handles FK ordering automatically).

**Step 6 — Verify row counts** across every table before cutting over.

**Step 7 — Cut over:** Update `/etc/family-app/env` with PostgreSQL credentials, restart `family-app` service. Keep the SQLite backup on S3 for 90 days.

---

## Phase 4 — Production Hardening

### 4.1 Move Off Lightsail (Optional)

Lightsail works at low traffic but has a fixed resource ceiling. For SaaS consider:
- **App:** AWS ECS with Fargate (containerized gunicorn — add `Dockerfile`)
- **Database:** RDS PostgreSQL (already provisioned in Phase 3)
- **Static files:** S3 + CloudFront instead of WhiteNoise
- **Media/uploads:** S3 with presigned URLs (needed for photo uploads in cookbook, etc.)

A `Dockerfile` for the current app is straightforward — the gunicorn command, `collectstatic` as part of the image build, and environment variables via ECS task definition secrets.

### 4.2 Rate Limiting

Add `django-ratelimit` to prevent abuse of invitation endpoints and auth:
```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key="ip", rate="5/m", block=True)
def invite_send(request): ...
```

### 4.3 Data Export (GDPR / Trust)

Each account owner should be able to download all their family's data as a ZIP of CSV files. This is both a GDPR obligation in the EU and a trust signal for users hesitant to commit their data to a new SaaS.

```python
# core/views.py
class DataExportView(SubscriptionRequiredMixin, LoginRequiredMixin, View):
    def post(self, request):
        # Async task (Celery or a simple management command triggered via subprocess)
        # Export: vehicles, properties, recipes, tasks, vacations, shopping history
        # Zip + upload to S3, email signed URL to account owner
        ...
```

### 4.4 Feature Flags

A lightweight per-account feature flag table lets you roll out features gradually without redeploys:

```python
class AccountFeatureFlag(models.Model):
    account = models.ForeignKey(FamilyAccount, on_delete=models.CASCADE)
    flag = models.CharField(max_length=100)
    enabled = models.BooleanField(default=False)
```

Use in templates: `{% if request.account|has_flag:"photo_uploads" %}`.

---

## Summary: Recommended Release Order

| Release | Work | Risk |
|---------|------|------|
| **v1.1** | Automated SQLite backups, Sentry | Low |
| **v1.2** | Baseline test coverage | Low |
| **v2.0** | FamilyAccount + non-breaking FK injection (Migration A+B) | Medium |
| **v2.1** | TenantMiddleware + AccountScopedMixin on all views | Medium-High |
| **v2.2** | Migration C (make FK required) | Low (after backfill verified) |
| **v2.3** | PostgreSQL migration | Medium |
| **v3.0** | Stripe billing + SubscriptionRequiredMixin | Medium |
| **v3.1** | Invitation system + onboarding flow | Medium |
| **v3.2** | Transactional email (SES) | Low |
| **v4.0** | Data export, rate limiting, feature flags | Low |
| **v4.1** | Containerize + move to ECS (optional) | High |

The riskiest single step is **v2.1** — applying `AccountScopedMixin` to all views. That is where an accidental missing filter could leak one family's data to another. Write the isolation tests in v1.2 so they fail loudly if any view gets the filter wrong.

---

*Last updated: 2026-06-23*
