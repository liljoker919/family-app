from .base import *  # noqa: F401, F403

DEBUG = True

SECRET_KEY = "django-insecure-dev-only-key-never-use-in-production-abc123xyz789"

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
