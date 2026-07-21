from datetime import datetime, timezone as dt_timezone
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from core.models import FamilyAccount, FamilyMembership

from .models import ExternalCalendarFeed, is_allowed_ical_host
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

_GOOGLE_URL = "https://calendar.google.com/calendar/ical/abc123/basic.ics"
_OUTLOOK_URL = "https://outlook.live.com/owa/calendar/abc123/calendar.ics"


def _mock_response(url=_GOOGLE_URL):
    resp = Mock()
    resp.content = _ICS_PAYLOAD
    resp.raise_for_status = Mock()
    resp.url = url  # final URL post-redirect — checked again in _fetch_ical_events (#355)
    return resp


class IsAllowedIcalHostTestCase(TestCase):
    """#355 — the feed URL is fetched server-side (SSRF shape), so it's
    restricted to the actual calendar-provider hostnames this feature
    supports rather than accepting any URL."""

    def test_accepts_google_and_outlook(self):
        self.assertTrue(is_allowed_ical_host(_GOOGLE_URL))
        self.assertTrue(is_allowed_ical_host(_OUTLOOK_URL))
        self.assertTrue(is_allowed_ical_host("https://outlook.office365.com/owa/calendar/x/calendar.ics"))

    def test_rejects_non_provider_host(self):
        self.assertFalse(is_allowed_ical_host("https://example.com/feed.ics"))

    def test_rejects_internal_and_metadata_hosts(self):
        self.assertFalse(is_allowed_ical_host("http://169.254.169.254/latest/meta-data/"))
        self.assertFalse(is_allowed_ical_host("http://localhost/feed.ics"))
        self.assertFalse(is_allowed_ical_host("http://127.0.0.1/feed.ics"))
        self.assertFalse(is_allowed_ical_host("http://10.0.0.5/feed.ics"))

    def test_rejects_lookalike_subdomain_trick(self):
        self.assertFalse(is_allowed_ical_host("https://calendar.google.com.evil.example/feed.ics"))

    def test_rejects_non_https_scheme(self):
        self.assertFalse(is_allowed_ical_host("http://calendar.google.com/calendar/ical/abc/basic.ics"))

    def test_rejects_malformed_url(self):
        self.assertFalse(is_allowed_ical_host("not a url"))
        self.assertFalse(is_allowed_ical_host(""))


class FetchIcalEventsTestCase(TestCase):
    """Unit coverage for the fetcher that replaced the old separate
    Google-API and Outlook-iCal implementations (#338)."""

    @patch("calendar_events.views.requests.get", return_value=_mock_response())
    def test_parses_events_with_provider_prefix_and_color(self, mock_get):
        events = _fetch_ical_events(_GOOGLE_URL, "google", None, None)
        mock_get.assert_called_once_with(_GOOGLE_URL, timeout=10)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["id"], "google-test-event-1")
        self.assertEqual(events[0]["title"], "Test Event")
        self.assertEqual(events[0]["color"], "#10B981")
        self.assertEqual(events[0]["extendedProps"]["type"], "google")

    @patch("calendar_events.views.requests.get", return_value=_mock_response(url=_OUTLOOK_URL))
    def test_outlook_provider_gets_its_own_color(self, mock_get):
        events = _fetch_ical_events(_OUTLOOK_URL, "outlook", None, None)
        self.assertEqual(events[0]["color"], "#8B5CF6")
        self.assertEqual(events[0]["id"], "outlook-test-event-1")

    def test_disallowed_host_never_reaches_requests_get(self):
        with patch("calendar_events.views.requests.get") as mock_get:
            events = _fetch_ical_events("https://example.com/feed.ics", "google", None, None)
        mock_get.assert_not_called()
        self.assertEqual(events, [])

    @patch("calendar_events.views.requests.get", return_value=_mock_response(url="https://internal.example/steal"))
    def test_redirect_off_allowlist_is_rejected_after_fetch(self, mock_get):
        # ical_url itself passes the pre-fetch check, but the response's
        # final (post-redirect) URL doesn't — must still be rejected.
        events = _fetch_ical_events(_GOOGLE_URL, "google", None, None)
        mock_get.assert_called_once()
        self.assertEqual(events, [])


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
            account=self.account_a, provider="google", ical_url=_GOOGLE_URL,
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

    @patch("calendar_events.views.requests.get", return_value=_mock_response())
    def test_successful_fetch_clears_last_error_and_records_checked_at(self, mock_get):
        feed = ExternalCalendarFeed.objects.get(account=self.account_a)
        feed.last_error = "some stale error from before"
        feed.save(update_fields=["last_error"])

        collect_events(self.account_a, None, None)

        feed.refresh_from_db()
        self.assertEqual(feed.last_error, "")
        self.assertIsNotNone(feed.last_checked_at)

    def test_failed_fetch_records_last_error_without_crashing(self):
        feed = ExternalCalendarFeed.objects.get(account=self.account_a)
        self.assertEqual(feed.last_error, "")
        self.assertIsNone(feed.last_checked_at)

        with patch("calendar_events.views.requests.get", side_effect=Exception("HTTPError: 500 Server Error")):
            events = collect_events(self.account_a, None, None)  # must not raise

        self.assertEqual(events, [])
        feed.refresh_from_db()
        self.assertIn("500 Server Error", feed.last_error)
        self.assertIsNotNone(feed.last_checked_at)


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

    def test_get_shows_how_to_guide(self):
        response = self.client.get("/calendar/settings/")
        self.assertContains(response, "How do I find this?")
        self.assertContains(response, "Integrate calendar")
        self.assertContains(response, "Shared calendars")

    def test_shows_failed_sync_indicator(self):
        from django.utils import timezone as tz  # noqa: PLC0415

        ExternalCalendarFeed.objects.create(
            account=self.account, provider="google", ical_url=_GOOGLE_URL,
            last_checked_at=tz.now(), last_error="HTTPError: 500 Server Error",
        )
        response = self.client.get("/calendar/settings/")
        self.assertContains(response, "Last sync failed")
        self.assertContains(response, "HTTPError: 500 Server Error")

    def test_shows_synced_indicator_when_no_error(self):
        from django.utils import timezone as tz  # noqa: PLC0415

        ExternalCalendarFeed.objects.create(
            account=self.account, provider="google", ical_url=_GOOGLE_URL, last_checked_at=tz.now(),
        )
        response = self.client.get("/calendar/settings/")
        self.assertContains(response, "Synced")

    def test_post_creates_feed_scoped_to_own_account(self):
        response = self.client.post(
            "/calendar/settings/add/",
            {"provider": "outlook", "ical_url": _OUTLOOK_URL},
        )
        self.assertRedirects(response, "/calendar/settings/")
        feed = ExternalCalendarFeed.objects.get(ical_url=_OUTLOOK_URL)
        self.assertEqual(feed.account, self.account)
        self.assertEqual(feed.provider, "outlook")

    def test_post_disallowed_host_does_not_create_feed(self):
        response = self.client.post(
            "/calendar/settings/add/",
            {"provider": "google", "ical_url": "https://example.com/feed.ics"},
        )
        self.assertRedirects(response, "/calendar/settings/")
        self.assertFalse(ExternalCalendarFeed.objects.filter(ical_url="https://example.com/feed.ics").exists())

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
