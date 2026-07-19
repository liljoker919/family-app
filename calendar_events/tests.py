from datetime import datetime, timezone as dt_timezone
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from core.models import FamilyAccount, FamilyMembership

from .models import ExternalCalendarFeed
from .views import _fetch_ical_events, collect_events

User = get_user_model()

_ICS_PAYLOAD = b"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-event-1
SUMMARY:Test Event
DTSTART:20260801T090000Z
DTEND:20260801T100000Z
END:VEVENT
END:VCALENDAR
"""


def _mock_response():
    resp = Mock()
    resp.content = _ICS_PAYLOAD
    resp.raise_for_status = Mock()
    return resp


class FetchIcalEventsTestCase(TestCase):
    """Unit coverage for the fetcher that replaced the old separate
    Google-API and Outlook-iCal implementations (#338)."""

    @patch("calendar_events.views.requests.get", return_value=_mock_response())
    def test_parses_events_with_provider_prefix_and_color(self, mock_get):
        events = _fetch_ical_events("https://example.com/feed.ics", "google", None, None)
        mock_get.assert_called_once_with("https://example.com/feed.ics", timeout=10)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["id"], "google-test-event-1")
        self.assertEqual(events[0]["title"], "Test Event")
        self.assertEqual(events[0]["color"], "#10B981")
        self.assertEqual(events[0]["extendedProps"]["type"], "google")

    @patch("calendar_events.views.requests.get", return_value=_mock_response())
    def test_outlook_provider_gets_its_own_color(self, mock_get):
        events = _fetch_ical_events("https://example.com/feed.ics", "outlook", None, None)
        self.assertEqual(events[0]["color"], "#8B5CF6")
        self.assertEqual(events[0]["id"], "outlook-test-event-1")


class CollectEventsExternalFeedTestCase(TestCase):
    """The bug #338 actually fixes: external feeds must be per-account, not
    global — every tenant used to see the same (the app owner's) calendar."""

    def setUp(self):
        self.user_a = User.objects.create_user(username="feed_user_a", password="pass12345")
        self.account_a = FamilyAccount.objects.create(
            name="Feed Family A", slug="feed-family-a", owner=self.user_a, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_a, user=self.user_a, role="owner")

        self.user_b = User.objects.create_user(username="feed_user_b", password="pass12345")
        self.account_b = FamilyAccount.objects.create(
            name="Feed Family B", slug="feed-family-b", owner=self.user_b, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_b, user=self.user_b, role="owner")

        ExternalCalendarFeed.objects.create(
            account=self.account_a, provider="google", ical_url="https://example.com/a.ics",
        )

    @patch("calendar_events.views.requests.get", return_value=_mock_response())
    def test_only_the_owning_account_sees_its_feed(self, mock_get):
        events_a = collect_events(self.account_a, None, None)
        self.assertTrue(any(e["id"] == "google-test-event-1" for e in events_a))

        events_b = collect_events(self.account_b, None, None)
        self.assertFalse(any(e["id"] == "google-test-event-1" for e in events_b))
        mock_get.assert_called_once()  # only fetched for account_a, never for account_b

    def test_account_with_no_feeds_makes_no_http_calls(self):
        with patch("calendar_events.views.requests.get") as mock_get:
            collect_events(self.account_b, None, None)
            mock_get.assert_not_called()


class FeedSettingsViewTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="settings_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Settings Family", slug="settings-family", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client.login(username="settings_user", password="pass12345")

    def test_get_shows_empty_state(self):
        response = self.client.get("/calendar/settings/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No calendar feeds connected yet")

    def test_post_creates_feed_scoped_to_own_account(self):
        response = self.client.post(
            "/calendar/settings/add/",
            {"provider": "outlook", "ical_url": "https://example.com/mine.ics"},
        )
        self.assertRedirects(response, "/calendar/settings/")
        feed = ExternalCalendarFeed.objects.get(ical_url="https://example.com/mine.ics")
        self.assertEqual(feed.account, self.account)
        self.assertEqual(feed.provider, "outlook")

    def test_delete_removes_own_feed(self):
        feed = ExternalCalendarFeed.objects.create(
            account=self.account, provider="google", ical_url="https://example.com/gone.ics",
        )
        response = self.client.post(f"/calendar/settings/{feed.pk}/delete/")
        self.assertRedirects(response, "/calendar/settings/")
        self.assertFalse(ExternalCalendarFeed.objects.filter(pk=feed.pk).exists())

    def test_cannot_delete_another_accounts_feed(self):
        other_user = User.objects.create_user(username="other_settings_user", password="pass12345")
        other_account = FamilyAccount.objects.create(
            name="Other Settings Family", slug="other-settings-family", owner=other_user,
        )
        other_feed = ExternalCalendarFeed.objects.create(
            account=other_account, provider="google", ical_url="https://example.com/notyours.ics",
        )
        response = self.client.post(f"/calendar/settings/{other_feed.pk}/delete/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(ExternalCalendarFeed.objects.filter(pk=other_feed.pk).exists())

    def test_free_tier_redirects_to_upgrade(self):
        self.account.tier = FamilyAccount.TIER_FREE
        self.account.save(update_fields=["tier"])
        response = self.client.get("/calendar/settings/")
        self.assertRedirects(response, "/upgrade/")
