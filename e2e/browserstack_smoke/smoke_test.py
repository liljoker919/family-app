import pytest

from .conftest import E2E_TEST_PASSWORD, E2E_TEST_USERNAME, HAS_TEST_CREDS

skip_without_creds = pytest.mark.skipif(
    not HAS_TEST_CREDS,
    reason="E2E_TEST_USERNAME/E2E_TEST_PASSWORD not configured",
)


def test_homepage_loads(bstack_page):
    response = bstack_page.goto("/")
    assert response.ok
    assert "Hey Famly" in bstack_page.title()


@skip_without_creds
def test_login_redirects_to_dashboard(bstack_page):
    bstack_page.goto("/accounts/login/")
    bstack_page.fill("#id_username", E2E_TEST_USERNAME)
    bstack_page.fill("#id_password", E2E_TEST_PASSWORD)
    bstack_page.click("button[type=submit]")
    bstack_page.wait_for_url("**/dashboard/")


@skip_without_creds
def test_dashboard_loads_without_errors(bstack_page):
    page_errors = []
    console_errors = []
    bstack_page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    bstack_page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    bstack_page.goto("/accounts/login/")
    bstack_page.fill("#id_username", E2E_TEST_USERNAME)
    bstack_page.fill("#id_password", E2E_TEST_PASSWORD)
    bstack_page.click("button[type=submit]")
    bstack_page.wait_for_url("**/dashboard/")

    response = bstack_page.goto("/dashboard/")
    assert response.ok
    assert "Dashboard" in bstack_page.title()
    assert not page_errors, f"JS errors on dashboard: {page_errors}"
    assert not console_errors, f"Console errors on dashboard: {console_errors}"
