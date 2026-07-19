from .base import *  # noqa: F401, F403

DEBUG = False
SECRET_KEY = "django-insecure-ci-test-key-not-for-production"
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Suppress WhiteNoise warning about missing staticfiles dir in CI
WHITENOISE_AUTOREFRESH = True
STATICFILES_DIRS = []
