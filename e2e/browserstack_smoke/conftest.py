import datetime
import json
import os
import urllib.parse

import pytest

BASE_URL = os.environ.get("BASE_URL", "https://heyfamlyapp.com")
BROWSERSTACK_USERNAME = os.environ.get("BROWSERSTACK_USERNAME")
BROWSERSTACK_ACCESS_KEY = os.environ.get("BROWSERSTACK_ACCESS_KEY")
BROWSERSTACK_BUILD_NAME = os.environ.get(
    "BROWSERSTACK_BUILD_NAME",
    f"heyfamly-weekly-{datetime.date.today().isoformat()}",
)
# Matches the existing "Family App" project in BrowserStack Automate
# (automate.browserstack.com/projects/Family+App) so weekly builds group
# under it instead of creating a new project implicitly.
BROWSERSTACK_PROJECT_ID = os.environ.get("BROWSERSTACK_PROJECT_ID", "Family App")

E2E_TEST_USERNAME = os.environ.get("E2E_TEST_USERNAME")
E2E_TEST_PASSWORD = os.environ.get("E2E_TEST_PASSWORD")
HAS_TEST_CREDS = bool(E2E_TEST_USERNAME and E2E_TEST_PASSWORD)

# One capability per browser/OS combo BrowserStack should run this build
# against. `name` becomes the individual test session's label in Automate;
# `build` groups all of them under the same weekly run.
BROWSERSTACK_CAPS = [
    {"browser": "playwright-chromium", "os": "Windows", "os_version": "11", "name": "chrome-windows"},
    {"browser": "playwright-webkit", "os": "OS X", "os_version": "Ventura", "name": "safari-mac"},
]


def _cdp_url(caps):
    payload = {
        **caps,
        "build": BROWSERSTACK_BUILD_NAME,
        "project": BROWSERSTACK_PROJECT_ID,
        "browserstack.username": BROWSERSTACK_USERNAME,
        "browserstack.accessKey": BROWSERSTACK_ACCESS_KEY,
    }
    return f"wss://cdp.browserstack.com/playwright?caps={urllib.parse.quote(json.dumps(payload))}"


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Stashes each phase's result on the test item so the bstack_page
    fixture's teardown can see whether the test actually passed — a plain
    CDP connection (see below) never tells BrowserStack that on its own."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)


@pytest.fixture(params=BROWSERSTACK_CAPS, ids=lambda caps: caps["name"])
def bstack_page(playwright, request):
    """A Page running on a remote BrowserStack browser.

    BrowserStack's CDP tunnel is always addressed via `chromium.connect()`,
    even when the requested capability is a different browser (e.g.
    webkit/Safari) — the tunnel negotiates the real remote browser itself.
    """
    browser = playwright.chromium.connect(_cdp_url(request.param))
    context = browser.new_context(base_url=BASE_URL)
    page = context.new_page()
    try:
        yield page
    finally:
        # A raw CDP connection (unlike the BrowserStack SDK/executable wrapper)
        # never reports pass/fail to Automate on its own — every session would
        # otherwise sit as "Unknown" regardless of what pytest decided. Tell
        # BrowserStack the real outcome via its executor hook before closing.
        setup_failed = getattr(request.node, "rep_setup", None) is not None and request.node.rep_setup.failed
        call_failed = getattr(request.node, "rep_call", None) is not None and request.node.rep_call.failed
        failed = setup_failed or call_failed
        reason = ""
        if failed:
            failing_rep = request.node.rep_call if call_failed else request.node.rep_setup
            reason = str(failing_rep.longrepr)[:250]
        try:
            page.evaluate(
                "_ => {}",
                "browserstack_executor: "
                + json.dumps({
                    "action": "setSessionStatus",
                    "arguments": {"status": "failed" if failed else "passed", "reason": reason},
                }),
            )
        except Exception:
            pass  # noqa: S110 — best-effort status report; never fail the test over it
        context.close()
        browser.close()
