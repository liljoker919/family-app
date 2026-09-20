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
        "project": "heyfamlyapp.com",
        "browserstack.username": BROWSERSTACK_USERNAME,
        "browserstack.accessKey": BROWSERSTACK_ACCESS_KEY,
    }
    return f"wss://cdp.browserstack.com/playwright?caps={urllib.parse.quote(json.dumps(payload))}"


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
        context.close()
        browser.close()
