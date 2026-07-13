from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone as tz

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


class DashboardUpcomingEventCountTest(TestCase):
    """The dashboard's Calendar tile must count events from every source the
    calendar page itself displays (manual events, vehicle service, vacations,
    maintenance projects, family tasks) — not just the CalendarEvent table."""

    def setUp(self):
        self.user = User.objects.create_user(username="dashuser", password="testpass")
        self.client = Client()
        self.client.login(username="dashuser", password="testpass")
        self.today = date.today()

    def _in_range(self, days):
        return self.today + timedelta(days=days)

    def test_counts_events_from_every_source_within_next_7_days(self):
        from calendar_events.models import CalendarEvent  # noqa: PLC0415
        from property.models import MaintenanceProject, Property  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415
        from vacations.models import Vacation  # noqa: PLC0415
        from vehicles.models import Vehicle, VehicleService  # noqa: PLC0415

        CalendarEvent.objects.create(
            title="Manual Event",
            start=tz.make_aware(datetime.combine(self._in_range(1), datetime.min.time())),
            event_type="manual",
        )

        vehicle = Vehicle.objects.create(
            year=2020, make="Honda", model="CR-V", vin="1HGCM82633A004352",
            color="Blue", license_plate="ABC123", current_mileage=30000,
            registration_expiry=self._in_range(365),
        )
        VehicleService.objects.create(
            vehicle=vehicle, service_type="oil_change", date=self._in_range(2),
            mileage_at_service=30100,
        )

        Vacation.objects.create(
            name="Beach Trip", destination="Outer Banks",
            start_date=self._in_range(3), end_date=self._in_range(4),
        )

        prop = Property.objects.create(name="Rental House", address="123 Main St")
        MaintenanceProject.objects.create(
            prop=prop, title="Fix gutter", due_date=self._in_range(5), status="planned",
        )

        FamilyTask.objects.create(
            title="Pack for trip", status="TODO", priority="medium", due_date=self._in_range(6),
        )

        response = self.client.get("/")
        self.assertEqual(response.context["upcoming_event_count"], 5)
        self.assertContains(response, "5 events")

    def test_excludes_events_outside_window_and_completed_or_on_hold_items(self):
        from calendar_events.models import CalendarEvent  # noqa: PLC0415
        from property.models import MaintenanceProject, Property  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415
        from vacations.models import Vacation  # noqa: PLC0415

        # Outside the 7-day window entirely.
        CalendarEvent.objects.create(
            title="Far Future Event",
            start=tz.make_aware(datetime.combine(self._in_range(30), datetime.min.time())),
            event_type="manual",
        )
        Vacation.objects.create(
            name="Next Year Trip", destination="Paris",
            start_date=self._in_range(60), end_date=self._in_range(67),
        )

        # Within the window but excluded due to status.
        prop = Property.objects.create(name="Rental House", address="123 Main St")
        MaintenanceProject.objects.create(
            prop=prop, title="On hold repair", due_date=self._in_range(2), status="on_hold",
        )
        FamilyTask.objects.create(
            title="Already done", status="COMPLETED", priority="low", due_date=self._in_range(2),
        )

        response = self.client.get("/")
        self.assertEqual(response.context["upcoming_event_count"], 0)
        self.assertContains(response, "0 events")


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


class AuthenticatedAccessTestCase(TestCase):
    """Every application endpoint must return 200 for an authenticated user
    when the referenced object exists — the authenticated counterpart to
    AuthGuardTestCase's anonymous-redirect check."""

    def setUp(self):
        self.user = User.objects.create_user(username="smokeuser", password="testpass")
        self.client = Client()
        self.client.login(username="smokeuser", password="testpass")

        from calendar_events.models import CalendarEvent  # noqa: PLC0415
        from cookbook.models import Recipe  # noqa: PLC0415
        from property.models import Property  # noqa: PLC0415
        from shopping.models import ShoppingItem  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415
        from vacations.models import Vacation  # noqa: PLC0415
        from vehicles.models import Vehicle  # noqa: PLC0415

        today = date.today()

        self.vehicle = Vehicle.objects.create(
            year=2020, make="Honda", model="CR-V", vin="1HGCM82633A004999",
            color="Blue", license_plate="XYZ789", current_mileage=15000,
            registration_expiry=today + timedelta(days=365),
        )
        self.prop = Property.objects.create(name="Home", address="1 Main St")
        self.task = FamilyTask.objects.create(title="Smoke Task", status="TODO", priority="medium")
        self.shopping_item = ShoppingItem.objects.create(name="Milk", category="DAIRY")
        self.recipe = Recipe.objects.create(title="Smoke Recipe", category="DINNER")
        self.vacation = Vacation.objects.create(
            name="Smoke Trip", destination="Nowhere",
            start_date=today, end_date=today + timedelta(days=1),
        )
        self.event = CalendarEvent.objects.create(
            title="Smoke Event",
            start=tz.make_aware(datetime.combine(today, datetime.min.time())),
            event_type="manual",
        )

    def _endpoints(self):
        return [
            "/",
            "/vehicles/",
            "/vehicles/add/",
            f"/vehicles/{self.vehicle.pk}/",
            f"/vehicles/{self.vehicle.pk}/edit/",
            f"/vehicles/{self.vehicle.pk}/delete/",
            "/property/",
            "/property/add/",
            f"/property/{self.prop.pk}/",
            f"/property/{self.prop.pk}/edit/",
            f"/property/{self.prop.pk}/delete/",
            "/tasks/",
            "/tasks/new/",
            f"/tasks/{self.task.pk}/",
            f"/tasks/{self.task.pk}/edit/",
            f"/tasks/{self.task.pk}/delete/",
            "/shopping/",
            "/shopping/add/",
            f"/shopping/{self.shopping_item.pk}/edit/",
            f"/shopping/{self.shopping_item.pk}/delete/",
            "/cookbook/",
            "/cookbook/add/",
            f"/cookbook/{self.recipe.pk}/",
            f"/cookbook/{self.recipe.pk}/edit/",
            f"/cookbook/{self.recipe.pk}/delete/",
            "/vacations/",
            "/vacations/new/",
            f"/vacations/{self.vacation.pk}/",
            f"/vacations/{self.vacation.pk}/edit/",
            f"/vacations/{self.vacation.pk}/delete/",
            "/calendar/",
            "/calendar/event/add/",
            f"/calendar/event/{self.event.pk}/edit/",
            f"/calendar/event/{self.event.pk}/delete/",
        ]

    def test_authenticated_get_returns_200(self):
        for url in self._endpoints():
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code,
                    200,
                    f"Expected 200 for GET {url}, got {response.status_code}",
                )


class CrossTenantIsolationTestCase(TestCase):
    """User B must never see User A's records — via list views, dashboard
    counts, or the calendar feed — and must get a plain 404 (not a leak,
    not a 403 confirming existence) when guessing at A's object URLs."""

    def setUp(self):
        import json  # noqa: PLC0415

        from calendar_events.models import CalendarEvent  # noqa: PLC0415
        from cookbook.models import Recipe  # noqa: PLC0415
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415
        from property.models import MaintenanceProject, Property  # noqa: PLC0415
        from shopping.models import ShoppingItem  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415
        from vacations.models import Vacation  # noqa: PLC0415
        from vehicles.models import Vehicle, VehicleService  # noqa: PLC0415

        self.json = json

        self.user_a = User.objects.create_user(username="tenant_a", password="pass")
        self.user_b = User.objects.create_user(username="tenant_b", password="pass")

        self.account_a = FamilyAccount.objects.create(name="Family A", slug="family-a", owner=self.user_a)
        FamilyMembership.objects.create(account=self.account_a, user=self.user_a, role="owner")

        self.account_b = FamilyAccount.objects.create(name="Family B", slug="family-b", owner=self.user_b)
        FamilyMembership.objects.create(account=self.account_b, user=self.user_b, role="owner")

        self.client_b = Client()
        self.client_b.login(username="tenant_b", password="pass")

        today = date.today()

        self.vehicle_a = Vehicle.objects.create(
            account=self.account_a, year=2020, make="Honda", model="Civic",
            vin="1HGCM82633A004777", color="Blue", license_plate="AAA111",
            current_mileage=1000, registration_expiry=today + timedelta(days=365),
        )
        VehicleService.objects.create(
            vehicle=self.vehicle_a, service_type="oil_change", date=today, mileage_at_service=1000,
        )
        self.property_a = Property.objects.create(account=self.account_a, name="A's House", address="1 A St")
        self.maintenance_a = MaintenanceProject.objects.create(prop=self.property_a, title="Fix roof")
        self.event_a = CalendarEvent.objects.create(
            account=self.account_a, title="A's Event",
            start=tz.make_aware(datetime.combine(today, datetime.min.time())), event_type="manual",
        )
        self.vacation_a = Vacation.objects.create(
            account=self.account_a, name="A's Trip", destination="Paris",
            start_date=today, end_date=today + timedelta(days=5),
        )
        self.recipe_a = Recipe.objects.create(account=self.account_a, title="A's Recipe", category="DINNER")
        self.shopping_item_a = ShoppingItem.objects.create(account=self.account_a, name="A's Milk", category="DAIRY")
        self.task_a = FamilyTask.objects.create(
            account=self.account_a, title="A's Task", status="TODO", priority="medium",
        )

    def test_list_views_never_show_other_accounts_data(self):
        list_urls_and_needles = [
            ("/vehicles/", "Honda"),
            ("/property/", "A's House"),
            ("/vacations/", "A's Trip"),
            ("/cookbook/", "A's Recipe"),
            ("/shopping/", "A's Milk"),
        ]
        for url, needle in list_urls_and_needles:
            with self.subTest(url=url):
                response = self.client_b.get(url)
                self.assertNotContains(response, needle)

    def test_detail_and_edit_views_404_for_other_accounts_objects(self):
        urls = [
            f"/vehicles/{self.vehicle_a.pk}/",
            f"/vehicles/{self.vehicle_a.pk}/edit/",
            f"/vehicles/{self.vehicle_a.pk}/delete/",
            f"/vehicles/{self.vehicle_a.pk}/service/add/",
            f"/property/{self.property_a.pk}/",
            f"/property/{self.property_a.pk}/edit/",
            f"/property/{self.property_a.pk}/delete/",
            f"/property/maintenance/{self.maintenance_a.pk}/edit/",
            f"/property/maintenance/{self.maintenance_a.pk}/delete/",
            f"/vacations/{self.vacation_a.pk}/",
            f"/vacations/{self.vacation_a.pk}/edit/",
            f"/vacations/{self.vacation_a.pk}/delete/",
            f"/cookbook/{self.recipe_a.pk}/",
            f"/cookbook/{self.recipe_a.pk}/edit/",
            f"/cookbook/{self.recipe_a.pk}/delete/",
            f"/shopping/{self.shopping_item_a.pk}/edit/",
            f"/shopping/{self.shopping_item_a.pk}/delete/",
            f"/tasks/{self.task_a.pk}/",
            f"/tasks/{self.task_a.pk}/edit/",
            f"/tasks/{self.task_a.pk}/delete/",
            f"/calendar/event/{self.event_a.pk}/edit/",
            f"/calendar/event/{self.event_a.pk}/delete/",
        ]
        for url in urls:
            with self.subTest(url=url):
                response = self.client_b.get(url)
                self.assertEqual(
                    response.status_code, 404,
                    f"Expected 404 for GET {url}, got {response.status_code}",
                )

    def test_dashboard_counts_do_not_include_other_accounts_data(self):
        response = self.client_b.get("/")
        self.assertEqual(response.context["vehicle_count"], 0)
        self.assertEqual(response.context["property_count"], 0)
        self.assertEqual(response.context["upcoming_event_count"], 0)

    def test_calendar_json_excludes_other_accounts_events(self):
        response = self.client_b.get("/calendar/events.json")
        self.assertEqual(response.status_code, 200)
        payload = self.json.loads(response.content)
        titles = [e["title"] for e in payload]
        self.assertNotIn("A's Event", titles)
