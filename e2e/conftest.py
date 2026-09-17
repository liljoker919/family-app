"""pytest-django + pytest-playwright wiring for the e2e/ suite (#372).

`live_server` (from pytest-django) starts a real Django dev server thread
against the test database — the same server-lifecycle machinery as Django's
own LiveServerTestCase — so Playwright drives real HTTP requests instead of
Django's request/response test Client. Requesting it in a test automatically
gives that test transactional database access; no extra `db` marker needed.

`page`/`browser`/`context` come from pytest-playwright.
"""

import os

import pytest

# Playwright's sync API drives its background asyncio loop through a
# greenlet switched in on the main thread, which makes asyncio.get_running_loop()
# return non-None there too — tripping Django's (real, but here a false
# positive: nothing is actually concurrent) "async-unsafe" ORM guard the
# instant live_server's session-scoped db setup runs alongside a
# session-scoped Playwright browser fixture. Scoped to this package only.
os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")

from e2e.helpers import create_account, login_as  # noqa: E402


@pytest.fixture
def account_factory(db):
    """Factory fixture: account_factory(tier="free", username="...") ->
    (user, account). See e2e.helpers.create_account for details."""

    def _make(**kwargs):
        return create_account(**kwargs)

    return _make


@pytest.fixture
def make_authenticated_page(browser, live_server, account_factory):
    """Factory fixture for a Playwright `page` whose browser context already
    carries a valid session cookie for a freshly created account — for tests
    that need to be logged in but aren't testing the login flow itself.

    Each call gets its own isolated browser context (not the shared `page`
    fixture), so a test can hold two independently logged-in accounts open
    at once without one login's session cookie clobbering the other's.

    Usage: page, user, account = make_authenticated_page(tier="family")
    """
    contexts = []

    def _make(**kwargs):
        user, account = account_factory(**kwargs)
        context = browser.new_context()
        login_as(context, live_server, user)
        contexts.append(context)
        return context.new_page(), user, account

    yield _make

    for context in contexts:
        context.close()
