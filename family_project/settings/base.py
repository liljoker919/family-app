from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Local apps
    "core",
    "vehicles",
    "property",
    "calendar_events",
    "vacations",
    # Utilities
    "django.contrib.humanize",
    "simple_history",
    "cookbook",
    "shopping",
    "tasks",
    "djstripe",
    "django_ses",
    "invitations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.TenantMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
]

ROOT_URLCONF = "family_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "family_project.wsgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/New_York"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/dashboard/"
LOGOUT_REDIRECT_URL = "/accounts/login/"

# dj-stripe: the paying subscriber is a FamilyAccount, not a User — set in base.py
# (not just prod.py) so every environment's migrations agree on the FK target.
DJSTRIPE_SUBSCRIBER_MODEL = "core.FamilyAccount"
DJSTRIPE_SUBSCRIBER_MODEL_REQUEST_CALLBACK = "core.djstripe_callbacks.get_subscriber_for_request"
# Required since dj-stripe 2.4, no default. "id" (Stripe's own string ID) is
# recommended for new installations — this is one, there's no prior data.
DJSTRIPE_FOREIGN_KEY_TO_FIELD = "id"

# django-invitations: this app has no django-allauth, so acceptance is wired
# through a custom adapter + signal (core/invitations_adapter.py) instead of
# allauth's user_signed_up. ACCEPT_INVITE_AFTER_SIGNUP=True means clicking the
# emailed link only verifies/stashes the email and redirects to signup — the
# invitation isn't actually marked accepted (and no FamilyMembership created)
# until that signup form is actually submitted successfully.
INVITATIONS_ADAPTER = "core.invitations_adapter.FamlyAppInvitationsAdapter"
INVITATIONS_ACCEPT_INVITE_AFTER_SIGNUP = True
INVITATIONS_SIGNUP_REDIRECT = "core:onboarding_signup"
INVITATIONS_CONFIRMATION_URL_NAME = "invitations:accept-invite"
