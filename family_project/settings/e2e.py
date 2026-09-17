import os

from .ci import *  # noqa: F401, F403

# Real browser E2E suite (e2e/) — same in-memory-sqlite/CI-key base as unit
# tests (family_project.settings.ci), plus the Stripe test-mode credentials
# #375's Family-tier-upgrade coverage needs. Left blank (billing stays inert,
# see core/views._create_family_checkout_session) when running locally
# without these exported.
STRIPE_LIVE_MODE = False
STRIPE_TEST_SECRET_KEY = os.environ.get("STRIPE_TEST_SECRET_KEY", "")
STRIPE_TEST_PUBLIC_KEY = os.environ.get("STRIPE_TEST_PUBLIC_KEY", "")
STRIPE_FAMILY_PRICE_ID = os.environ.get("STRIPE_FAMILY_PRICE_ID", "")
