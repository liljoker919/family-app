import tempfile

from .base import *  # noqa: F401, F403

DEBUG = False

# Uploaded test files (avatars, #313) go to a throwaway temp dir instead of
# the real media/ directory.
MEDIA_ROOT = tempfile.mkdtemp(prefix="family-app-ci-media-")
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
