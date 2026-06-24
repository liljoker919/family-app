from django.contrib.auth import get_user_model
from django.test import Client, TestCase

User = get_user_model()

_LOGIN_URL = "/accounts/login/"

# Every application GET endpoint. PK-based URLs use pk=1 — LoginRequiredMixin
# redirects before any DB lookup, so the object need not exist.
_ALL_ENDPOINTS = [
    # Dashboard
    "/",
    # Vehicles
    "/vehicles/",
    "/vehicles/add/",
    "/vehicles/1/",
    "/vehicles/1/edit/",
    "/vehicles/1/delete/",
    # Property
    "/property/",
    "/property/add/",
    "/property/1/",
    "/property/1/edit/",
    "/property/1/delete/",
    # Tasks
    "/tasks/",
    "/tasks/new/",
    "/tasks/1/",
    "/tasks/1/edit/",
    "/tasks/1/delete/",
    # Shopping
    "/shopping/",
    "/shopping/add/",
    "/shopping/1/edit/",
    "/shopping/1/delete/",
    # Cookbook
    "/cookbook/",
    "/cookbook/add/",
    "/cookbook/1/",
    "/cookbook/1/edit/",
    "/cookbook/1/delete/",
    # Vacations
    "/vacations/",
    "/vacations/new/",
    "/vacations/1/",
    "/vacations/1/edit/",
    "/vacations/1/delete/",
    # Calendar
    "/calendar/",
    "/calendar/event/add/",
    "/calendar/event/1/edit/",
    "/calendar/event/1/delete/",
]


class AuthGuardTestCase(TestCase):
    """Every application endpoint must redirect unauthenticated requests to login."""

    def setUp(self):
        self.client = Client()

    def test_anonymous_get_redirects_to_login(self):
        for url in _ALL_ENDPOINTS:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code,
                    302,
                    f"Expected 302 for GET {url}, got {response.status_code}",
                )
                self.assertIn(
                    _LOGIN_URL,
                    response["Location"],
                    f"Expected login redirect for GET {url}, got {response['Location']}",
                )
