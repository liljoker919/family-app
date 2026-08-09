from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.utils import timezone as tz

User = get_user_model()

_LOGIN_URL = "/accounts/login/"

# Every application GET endpoint. PK-based URLs use pk=1 — LoginRequiredMixin
# redirects before any DB lookup, so the object need not exist.
_ALL_ENDPOINTS = [
    # Dashboard
    "/dashboard/",
    # Upgrade
    "/upgrade/",
    "/upgrade/start/",
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
    # Family members / invitations
    "/invite/",
    # Profile
    "/profile/",
    "/profile/export/",
    "/profile/delete/",
    "/profile/manage-subscription/",
    "/accounts/password_change/",
    # Email verification
    "/verify-email/",
    "/verify-email/resend/",
]


class DashboardScheduleTestCase(TestCase):
    """#325 — the dashboard's Today & Tomorrow widget must aggregate events
    from every source the calendar page itself displays (manual events,
    vehicle service, vacations, maintenance projects, family tasks), and
    only for the next 2 days — not the old bare 7-day count tile."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="dashuser", password="testpass")
        self.account = FamilyAccount.objects.create(name="Dash Family", slug="dash-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="dashuser", password="testpass")
        self.today = date.today()

    def _in_range(self, days):
        return self.today + timedelta(days=days)

    def test_shows_events_from_every_source_within_today_and_tomorrow(self):
        from calendar_events.models import CalendarEvent  # noqa: PLC0415
        from property.models import MaintenanceProject, Property  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415
        from vehicles.models import Vehicle, VehicleService  # noqa: PLC0415

        CalendarEvent.objects.create(
            account=self.account, title="Manual Event",
            start=tz.make_aware(datetime.combine(self._in_range(0), datetime.min.time())),
            event_type="manual",
        )

        vehicle = Vehicle.objects.create(
            account=self.account, year=2020, make="Honda", model="CR-V", vin="1HGCM82633A004352",
            color="Blue", license_plate="ABC123", current_mileage=30000,
            registration_expiry=self._in_range(365),
        )
        VehicleService.objects.create(
            vehicle=vehicle, service_type="oil_change", date=self._in_range(1),
            mileage_at_service=30100,
        )

        prop = Property.objects.create(account=self.account, name="Rental House", address="123 Main St")
        MaintenanceProject.objects.create(
            prop=prop, title="Fix gutter", due_date=self._in_range(1), status="planned",
        )

        FamilyTask.objects.create(
            account=self.account, title="Pack for trip", status="TODO", priority="medium", due_date=self._in_range(0),
        )

        response = self.client.get("/dashboard/")
        events = response.context["schedule_events"]
        self.assertEqual(len(events), 4)
        self.assertContains(response, "Manual Event")
        self.assertContains(response, "Fix gutter")
        self.assertContains(response, "Pack for trip")

    def test_excludes_events_outside_the_2day_window_and_completed_or_on_hold_items(self):
        from calendar_events.models import CalendarEvent  # noqa: PLC0415
        from property.models import MaintenanceProject, Property  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415

        # Outside the 2-day window entirely.
        CalendarEvent.objects.create(
            account=self.account, title="Far Future Event",
            start=tz.make_aware(datetime.combine(self._in_range(30), datetime.min.time())),
            event_type="manual",
        )

        # Within the window but excluded due to status.
        prop = Property.objects.create(account=self.account, name="Rental House", address="123 Main St")
        MaintenanceProject.objects.create(
            prop=prop, title="On hold repair", due_date=self._in_range(1), status="on_hold",
        )
        FamilyTask.objects.create(
            account=self.account, title="Already done", status="COMPLETED", priority="low", due_date=self._in_range(1),
        )

        response = self.client.get("/dashboard/")
        self.assertEqual(response.context["schedule_events"], [])
        self.assertNotContains(response, "Far Future Event")


class DashboardWidgetsTestCase(TestCase):
    """#325 — Attention Needed, priority tasks, dinner suggestion, shopping
    list, and vehicle/property health widgets on the redesigned dashboard."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="widgets_user", password="testpass")
        self.account = FamilyAccount.objects.create(name="Widgets Family", slug="widgets-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client.login(username="widgets_user", password="testpass")
        self.today = date.today()

    def test_attention_banner_flags_overdue_task_expired_vehicle_and_near_maintenance(self):
        from property.models import MaintenanceProject, Property  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415
        from vehicles.models import Vehicle  # noqa: PLC0415

        overdue_task = FamilyTask.objects.create(
            account=self.account, title="Overdue Thing", status="TODO", priority="medium",
            due_date=self.today - timedelta(days=1),
        )
        Vehicle.objects.create(
            account=self.account, year=2018, make="Ford", model="Focus", vin="1HGCM82633A004111",
            color="White", license_plate="EXP123", current_mileage=40000,
            registration_expiry=self.today - timedelta(days=5),
        )
        prop = Property.objects.create(account=self.account, name="Main House", address="1 Elm St")
        MaintenanceProject.objects.create(
            prop=prop, title="Check HVAC", due_date=self.today + timedelta(days=3), status="planned",
        )

        response = self.client.get("/dashboard/")
        items = response.context["attention_items"]
        levels = {item["level"] for item in items}
        self.assertIn("red", levels)
        self.assertIn("amber", levels)
        self.assertContains(response, "Overdue Thing")
        self.assertContains(response, "Check HVAC")
        self.assertTrue(FamilyTask.objects.filter(pk=overdue_task.pk).exists())

    def test_attention_banner_absent_when_nothing_qualifies(self):
        response = self.client.get("/dashboard/")
        self.assertEqual(response.context["attention_items"], [])
        self.assertNotContains(response, "Attention Needed")

    def test_dinner_widget_shows_a_recipe_and_empty_state_without_one(self):
        response = self.client.get("/dashboard/")
        self.assertIsNone(response.context["dinner_recipe"])
        self.assertContains(response, "No recipes yet")

        from cookbook.models import Recipe  # noqa: PLC0415

        Recipe.objects.create(account=self.account, title="Tacos", category="DINNER", is_family_favorite=True)
        response = self.client.get("/dashboard/")
        self.assertEqual(response.context["dinner_recipe"].title, "Tacos")
        self.assertContains(response, "Tacos")

    def test_priority_tasks_sorted_urgent_first_then_by_due_date(self):
        from tasks.models import FamilyTask  # noqa: PLC0415

        low = FamilyTask.objects.create(account=self.account, title="Low one", status="TODO", priority="low")
        urgent = FamilyTask.objects.create(account=self.account, title="Urgent one", status="TODO", priority="urgent")
        FamilyTask.objects.create(account=self.account, title="Done one", status="COMPLETED", priority="urgent")

        response = self.client.get("/dashboard/")
        tasks = response.context["priority_tasks"]
        self.assertEqual([t.pk for t in tasks], [urgent.pk, low.pk])

    def test_shopping_widget_shows_items(self):
        from shopping.models import ShoppingItem  # noqa: PLC0415

        ShoppingItem.objects.create(account=self.account, name="Eggs", category="DAIRY")
        response = self.client.get("/dashboard/")
        self.assertContains(response, "Eggs")

    def test_vehicle_health_badge_reflects_registration_status(self):
        from vehicles.models import Vehicle  # noqa: PLC0415

        Vehicle.objects.create(
            account=self.account, year=2022, make="Toyota", model="Camry", vin="1HGCM82633A004222",
            color="Black", license_plate="GOOD123", current_mileage=1000,
            registration_expiry=self.today + timedelta(days=300),
        )
        response = self.client.get("/dashboard/")
        self.assertContains(response, "Good Shape")

    def test_task_checkbox_marks_complete_and_returns_to_dashboard(self):
        from tasks.models import FamilyTask  # noqa: PLC0415

        task = FamilyTask.objects.create(account=self.account, title="Finish me", status="TODO", priority="medium")
        response = self.client.post(
            f"/tasks/{task.pk}/status/",
            {"status": "COMPLETED", "next": "/dashboard/"},
        )
        self.assertRedirects(response, "/dashboard/")
        task.refresh_from_db()
        self.assertEqual(task.status, "COMPLETED")

    def test_add_recipe_ingredients_next_param_returns_to_dashboard(self):
        from cookbook.models import Ingredient, Recipe  # noqa: PLC0415

        recipe = Recipe.objects.create(account=self.account, title="Soup", category="DINNER")
        Ingredient.objects.create(recipe=recipe, name="Carrot")

        response = self.client.post(
            f"/shopping/recipe/{recipe.pk}/add/",
            {"next": "/dashboard/"},
        )
        self.assertRedirects(response, "/dashboard/")


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
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="smokeuser", password="testpass")
        self.account = FamilyAccount.objects.create(
            name="Smoke Family", slug="smoke-family", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
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
            account=self.account, year=2020, make="Honda", model="CR-V", vin="1HGCM82633A004999",
            color="Blue", license_plate="XYZ789", current_mileage=15000,
            registration_expiry=today + timedelta(days=365),
        )
        self.prop = Property.objects.create(account=self.account, name="Home", address="1 Main St")
        self.task = FamilyTask.objects.create(
            account=self.account, title="Smoke Task", status="TODO", priority="medium",
        )
        self.shopping_item = ShoppingItem.objects.create(account=self.account, name="Milk", category="DAIRY")
        self.recipe = Recipe.objects.create(account=self.account, title="Smoke Recipe", category="DINNER")
        self.vacation = Vacation.objects.create(
            account=self.account, name="Smoke Trip", destination="Nowhere",
            start_date=today, end_date=today + timedelta(days=1),
        )
        self.event = CalendarEvent.objects.create(
            account=self.account, title="Smoke Event",
            start=tz.make_aware(datetime.combine(today, datetime.min.time())),
            event_type="manual",
        )

    def _endpoints(self):
        return [
            "/dashboard/",
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
            "/invite/",
            "/profile/",
            "/accounts/password_change/",
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

        self.account_a = FamilyAccount.objects.create(
            name="Family A", slug="family-a", owner=self.user_a, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_a, user=self.user_a, role="owner")

        self.account_b = FamilyAccount.objects.create(
            name="Family B", slug="family-b", owner=self.user_b, tier=FamilyAccount.TIER_FAMILY,
        )
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

    def test_dashboard_does_not_include_other_accounts_data(self):
        response = self.client_b.get("/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["property_count"], 0)
        for needle in ["Honda", "A's House", "Fix roof", "A's Event", "A's Task"]:
            self.assertNotContains(response, needle)

    def test_calendar_json_excludes_other_accounts_events(self):
        response = self.client_b.get("/calendar/events.json")
        self.assertEqual(response.status_code, 200)
        payload = self.json.loads(response.content)
        titles = [e["title"] for e in payload]
        self.assertNotIn("A's Event", titles)


class NoAccountUserTestCase(TestCase):
    """An authenticated user with no FamilyMembership at all (request.account
    is None) must never see account-less/legacy rows just because both sides
    of an `account=None` filter happen to match — see #327/#328/#329/#330.

    property/vehicles are Family-tier-gated (#308): SubscriptionRequiredMixin
    now intercepts account=None requests before AccountScopedMixin/
    AccountStampMixin ever run, so those endpoints redirect to the upgrade
    page rather than exercising the underlying no-leak behavior directly.
    tasks is Free-tier (ungated), so it still exercises AccountScopedMixin/
    AccountStampMixin's account=None handling directly — that protection
    remains load-bearing for every Free-tier-accessible module.
    """

    def setUp(self):
        from property.models import Property  # noqa: PLC0415
        from tasks.models import FamilyTask  # noqa: PLC0415

        self.no_account_user = User.objects.create_user(username="no_account", password="pass")
        self.client_no_account = Client()
        self.client_no_account.login(username="no_account", password="pass")

        # Orphaned/legacy rows with no account — must never surface to a
        # user whose own request.account also resolves to None.
        self.orphaned_property = Property.objects.create(name="Orphaned House", address="0 Nowhere Ave")
        self.orphaned_task = FamilyTask.objects.create(title="Orphaned Task", status="TODO", priority="medium")

    def test_gated_list_view_redirects_to_upgrade(self):
        response = self.client_no_account.get("/property/")
        self.assertRedirects(response, "/upgrade/")

    def test_gated_detail_view_redirects_to_upgrade(self):
        response = self.client_no_account.get(f"/property/{self.orphaned_property.pk}/")
        self.assertRedirects(response, "/upgrade/")

    def test_gated_create_view_redirects_to_upgrade(self):
        response = self.client_no_account.post(
            "/vehicles/add/",
            {
                "year": 2021, "make": "Test", "model": "Car", "vin": "1HGCM82633A005555",
                "color": "Black", "license_plate": "NOACCT", "current_mileage": 10,
                "registration_expiry": "2030-01-01",
            },
        )
        self.assertRedirects(response, "/upgrade/")

    def test_ungated_list_view_is_empty_not_leaking_orphaned_rows(self):
        response = self.client_no_account.get("/tasks/")
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Orphaned Task")

    def test_ungated_detail_view_404s_on_orphaned_row(self):
        response = self.client_no_account.get(f"/tasks/{self.orphaned_task.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_ungated_create_view_blocked_with_403(self):
        response = self.client_no_account.post(
            "/tasks/new/",
            {"title": "New Task", "status": "TODO", "priority": "medium"},
        )
        self.assertEqual(response.status_code, 403)

    def test_dashboard_renders_with_no_leaked_orphaned_data(self):
        response = self.client_no_account.get("/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Orphaned Task")
        self.assertNotContains(response, "Orphaned House")


class SubscriptionRequiredMixinTestCase(TestCase):
    """Free-tier accounts must be redirected off Family-tier-only modules
    (vehicles/property/calendar/vacations/cookbook, #308) to the upgrade
    page, while Free-tier modules (tasks/shopping) and the dashboard itself
    stay reachable. Family-tier accounts get full access to both."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.free_user = User.objects.create_user(username="free_user", password="pass")
        self.free_account = FamilyAccount.objects.create(
            name="Free Family", slug="free-family", owner=self.free_user,
        )
        FamilyMembership.objects.create(account=self.free_account, user=self.free_user, role="owner")
        self.free_client = Client()
        self.free_client.login(username="free_user", password="pass")

        self.family_user = User.objects.create_user(username="family_user", password="pass")
        self.family_account = FamilyAccount.objects.create(
            name="Family Family", slug="family-family", owner=self.family_user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.family_account, user=self.family_user, role="owner")
        self.family_client = Client()
        self.family_client.login(username="family_user", password="pass")

    def test_free_tier_gated_endpoints_redirect_to_upgrade(self):
        gated_urls = ["/vehicles/", "/property/", "/calendar/", "/vacations/", "/cookbook/", "/calendar/settings/"]
        for url in gated_urls:
            with self.subTest(url=url):
                response = self.free_client.get(url)
                self.assertRedirects(response, "/upgrade/")

    def test_free_tier_ungated_endpoints_stay_reachable(self):
        ungated_urls = ["/dashboard/", "/tasks/", "/shopping/"]
        for url in ungated_urls:
            with self.subTest(url=url):
                response = self.free_client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_free_tier_calendar_json_returns_403(self):
        response = self.free_client.get("/calendar/events.json")
        self.assertEqual(response.status_code, 403)

    def test_family_tier_gated_endpoints_return_200(self):
        gated_urls = ["/vehicles/", "/property/", "/calendar/", "/vacations/", "/cookbook/", "/calendar/settings/"]
        for url in gated_urls:
            with self.subTest(url=url):
                response = self.family_client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_family_tier_calendar_json_returns_200(self):
        response = self.family_client.get("/calendar/events.json")
        self.assertEqual(response.status_code, 200)


class StripeWebhookTierTestCase(TestCase):
    """Stripe subscription webhooks must flip both `is_active` and `tier`
    together (#308) — is_active alone doesn't distinguish Free from Family."""

    def setUp(self):
        from core.models import FamilyAccount  # noqa: PLC0415

        self.user = User.objects.create_user(username="webhook_user", password="pass")
        self.account = FamilyAccount.objects.create(name="Webhook Family", slug="webhook-family", owner=self.user)

    def test_subscription_created_sets_family_tier_and_active(self):
        from unittest.mock import patch  # noqa: PLC0415

        from core.stripe_handlers import handle_subscription_created  # noqa: PLC0415

        with patch("core.stripe_handlers._account_for_stripe_customer", return_value=self.account):
            handle_subscription_created(sender=None, event=_FakeEvent())

        self.account.refresh_from_db()
        self.assertTrue(self.account.is_active)
        self.assertEqual(self.account.tier, self.account.TIER_FAMILY)

    def test_subscription_created_sends_activated_email(self):
        """#381 — previously flipped the tier with no confirmation/receipt at all."""
        from unittest.mock import patch  # noqa: PLC0415

        from django.core import mail  # noqa: PLC0415

        from core.stripe_handlers import handle_subscription_created  # noqa: PLC0415

        self.user.email = "webhook_user@example.com"
        self.user.save(update_fields=["email"])

        with patch("core.stripe_handlers._account_for_stripe_customer", return_value=self.account):
            handle_subscription_created(sender=None, event=_FakeEvent())

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["webhook_user@example.com"])
        self.assertIn("Family plan", sent.subject)

    def test_subscription_deleted_sets_free_tier_and_inactive(self):
        from unittest.mock import patch  # noqa: PLC0415

        from core.models import FamilyAccount  # noqa: PLC0415
        from core.stripe_handlers import handle_subscription_deleted  # noqa: PLC0415

        self.account.tier = FamilyAccount.TIER_FAMILY
        self.account.is_active = True
        self.account.save(update_fields=["tier", "is_active"])

        with patch("core.stripe_handlers._account_for_stripe_customer", return_value=self.account):
            handle_subscription_deleted(sender=None, event=_FakeEvent())

        self.account.refresh_from_db()
        self.assertFalse(self.account.is_active)
        self.assertEqual(self.account.tier, self.account.TIER_FREE)

    def test_subscription_deleted_sends_canceled_email(self):
        """#382 — previously flipped the tier back to Free with no email
        explaining that Family-tier modules are no longer accessible."""
        from unittest.mock import patch  # noqa: PLC0415

        from core.models import FamilyAccount  # noqa: PLC0415
        from django.core import mail  # noqa: PLC0415

        from core.stripe_handlers import handle_subscription_deleted  # noqa: PLC0415

        self.user.email = "webhook_user@example.com"
        self.user.save(update_fields=["email"])
        self.account.tier = FamilyAccount.TIER_FAMILY
        self.account.is_active = True
        self.account.save(update_fields=["tier", "is_active"])

        with patch("core.stripe_handlers._account_for_stripe_customer", return_value=self.account):
            handle_subscription_deleted(sender=None, event=_FakeEvent())

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["webhook_user@example.com"])
        self.assertIn("ended", sent.subject)

    def test_payment_failed_email_does_not_promise_a_reply_or_self_serve_action(self):
        """The sender is noreply@ and there's no self-serve payment-method
        update yet (#357 open) — the email must point to a real contact
        channel, not "reply to this email" or "update your payment method"
        with no link to do so."""
        from unittest.mock import patch  # noqa: PLC0415

        from django.core import mail  # noqa: PLC0415

        from core.stripe_handlers import handle_payment_failed  # noqa: PLC0415

        self.user.email = "webhook_user@example.com"
        self.user.save(update_fields=["email"])

        with patch("core.stripe_handlers._account_for_stripe_customer", return_value=self.account):
            handle_payment_failed(sender=None, event=_FakeEvent())

        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        self.assertIn("cnickerson@oakcitysoftwaresolutions.com", body)
        self.assertNotIn("reply to this email", body)


class _FakeEvent:
    """Minimal stand-in for a dj-stripe Event, just enough for
    `event.data.get("object", {}).get("customer")` in core/stripe_handlers.py."""

    data = {"object": {"customer": "cus_fake123"}}


class OnboardingSignupViewTestCase(TestCase):
    """Step 1 (#309) — the only place in the app that creates a User at all."""

    def setUp(self):
        from django.core.cache import cache  # noqa: PLC0415

        # OnboardingSignupView is rate-limited (5/min/IP); the default LocMemCache
        # backend persists across test methods within one test run, so clear it
        # per-test rather than let counters bleed between methods.
        cache.clear()
        self.client = Client()
        self.valid_data = {
            "family_name": "The Testers",
            "username": "newfamily",
            "email": "newfamily@example.com",
            "password1": "correct horse battery staple",
            "password2": "correct horse battery staple",
        }

    def test_get_renders_form_for_anonymous_user(self):
        response = self.client.get("/onboarding/signup/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "family_name")

    def test_get_with_plan_family_stashes_intent_in_session(self):
        """#388 fallout — carries the landing page's "Subscribe" CTA intent
        through to OnboardingPlanView, which skips the picker and redirects
        straight to Stripe Checkout once account creation completes."""
        self.client.get("/onboarding/signup/?plan=family")
        self.assertEqual(self.client.session.get("intended_plan"), "family")

    def test_get_without_plan_param_does_not_set_intent(self):
        self.client.get("/onboarding/signup/")
        self.assertIsNone(self.client.session.get("intended_plan"))

    def test_get_redirects_authenticated_user(self):
        User.objects.create_user(username="already_in", password="pass12345")
        self.client.login(username="already_in", password="pass12345")
        response = self.client.get("/onboarding/signup/")
        # /onboarding/ itself redirects further (no account yet) — just check
        # the immediate hop, not the final page.
        self.assertRedirects(response, "/onboarding/", fetch_redirect_response=False)

    def test_post_valid_creates_user_account_and_membership_and_logs_in(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        response = self.client.post("/onboarding/signup/", self.valid_data)
        self.assertRedirects(response, "/onboarding/invite/")

        user = User.objects.get(username="newfamily")
        self.assertEqual(user.email, "newfamily@example.com")

        account = FamilyAccount.objects.get(owner=user)
        self.assertEqual(account.name, "The Testers")
        self.assertEqual(account.tier, FamilyAccount.TIER_FREE)
        self.assertFalse(account.onboarding_complete)

        self.assertTrue(
            FamilyMembership.objects.filter(account=account, user=user, role="owner").exists()
        )

        # Logged in as part of signup — an authenticated-only page now works.
        dash_response = self.client.get("/onboarding/invite/")
        self.assertEqual(dash_response.status_code, 200)

    def test_post_valid_creates_unverified_email_and_sends_verification_email(self):
        """#377 — the founder signup path only; invited members prove email
        ownership by clicking the invite link, so never get a row here."""
        from django.core import mail  # noqa: PLC0415

        from core.models import EmailVerification  # noqa: PLC0415

        self.client.post("/onboarding/signup/", self.valid_data)
        user = User.objects.get(username="newfamily")

        verification = EmailVerification.objects.get(user=user)
        self.assertFalse(verification.verified)
        self.assertIsNone(verification.verified_at)

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["newfamily@example.com"])
        self.assertIn("/verify-email/", sent.body)

    def test_post_duplicate_username_rejected(self):
        User.objects.create_user(username="newfamily", password="whatever123")
        response = self.client.post("/onboarding/signup/", self.valid_data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "already taken")

    def test_post_password_mismatch_rejected(self):
        data = dict(self.valid_data, password2="something else entirely")
        response = self.client.post("/onboarding/signup/", data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "don&#x27;t match")

    def test_post_weak_password_rejected(self):
        data = dict(self.valid_data, password1="password", password2="password")
        response = self.client.post("/onboarding/signup/", data)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(username="newfamily").exists())


class OnboardingRedirectViewTestCase(TestCase):
    def test_anonymous_redirects_to_signup(self):
        response = self.client.get("/onboarding/")
        self.assertRedirects(response, "/onboarding/signup/")

    def test_authenticated_incomplete_redirects_to_invite(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        user = User.objects.create_user(username="onb_user", password="pass12345")
        account = FamilyAccount.objects.create(name="Onb Family", slug="onb-family", owner=user)
        FamilyMembership.objects.create(account=account, user=user, role="owner")
        self.client.login(username="onb_user", password="pass12345")

        response = self.client.get("/onboarding/")
        self.assertRedirects(response, "/onboarding/invite/")

    def test_authenticated_complete_redirects_to_dashboard(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        user = User.objects.create_user(username="done_user", password="pass12345")
        account = FamilyAccount.objects.create(
            name="Done Family", slug="done-family", owner=user, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=account, user=user, role="owner")
        self.client.login(username="done_user", password="pass12345")

        response = self.client.get("/onboarding/")
        self.assertRedirects(response, "/dashboard/")

    def test_authenticated_no_account_redirects_to_dashboard(self):
        User.objects.create_user(username="no_acct", password="pass12345")
        self.client.login(username="no_acct", password="pass12345")

        response = self.client.get("/onboarding/")
        self.assertRedirects(response, "/dashboard/")


class OnboardingInviteViewTestCase(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="invite_user", password="pass12345")
        self.account = FamilyAccount.objects.create(name="Invite Family", slug="invite-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client.login(username="invite_user", password="pass12345")

    def test_renders_when_incomplete(self):
        response = self.client.get("/onboarding/invite/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Continue")

    def test_redirects_to_dashboard_when_already_complete(self):
        self.account.onboarding_complete = True
        self.account.save(update_fields=["onboarding_complete"])
        response = self.client.get("/onboarding/invite/")
        self.assertRedirects(response, "/dashboard/")


class OnboardingPlanViewTestCase(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="plan_user", password="pass12345")
        self.account = FamilyAccount.objects.create(name="Plan Family", slug="plan-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client.login(username="plan_user", password="pass12345")

    def test_get_renders_when_incomplete(self):
        response = self.client.get("/onboarding/plan/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Subscribe")
        self.assertContains(response, "Skip for now")

    def test_get_redirects_to_dashboard_when_already_complete(self):
        self.account.onboarding_complete = True
        self.account.save(update_fields=["onboarding_complete"])
        response = self.client.get("/onboarding/plan/")
        self.assertRedirects(response, "/dashboard/")

    def test_get_with_intended_plan_family_skips_picker_and_redirects_to_stripe(self):
        from unittest.mock import patch  # noqa: PLC0415

        session = self.client.session
        session["intended_plan"] = "family"
        session.save()

        with patch(
            "core.views._create_family_checkout_session",
            return_value="https://checkout.stripe.com/test-session",
        ):
            response = self.client.get("/onboarding/plan/", follow=False)

        self.assertRedirects(
            response, "https://checkout.stripe.com/test-session", fetch_redirect_response=False,
        )
        self.assertNotIn("intended_plan", self.client.session)

    def test_get_with_intended_plan_family_but_checkout_unavailable_falls_back_to_picker(self):
        # Test settings never set STRIPE_FAMILY_PRICE_ID — checkout stays inert.
        session = self.client.session
        session["intended_plan"] = "family"
        session.save()

        response = self.client.get("/onboarding/plan/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Subscribe")
        self.assertNotIn("intended_plan", self.client.session)

    def test_post_free_marks_complete_and_redirects_dashboard(self):
        response = self.client.post("/onboarding/plan/", {"plan": "free"})
        self.assertRedirects(response, "/dashboard/")
        self.account.refresh_from_db()
        self.assertTrue(self.account.onboarding_complete)
        self.assertEqual(self.account.tier, self.account.TIER_FREE)

    def test_post_free_sends_welcome_email(self):
        from django.core import mail  # noqa: PLC0415

        self.user.email = "plan_user@example.com"
        self.user.save(update_fields=["email"])

        self.client.post("/onboarding/plan/", {"plan": "free"})

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Welcome to Hey Famly!")
        self.assertIn(self.account.name, mail.outbox[0].body)

    def test_post_family_with_no_price_id_configured_shows_error(self):
        # Test settings never set STRIPE_FAMILY_PRICE_ID — checkout stays inert.
        response = self.client.post("/onboarding/plan/", {"plan": "family"})
        self.assertRedirects(response, "/onboarding/plan/")
        self.account.refresh_from_db()
        self.assertFalse(self.account.onboarding_complete)

    def test_post_family_with_checkout_configured_redirects_to_stripe(self):
        from unittest.mock import patch  # noqa: PLC0415

        with patch(
            "core.views._create_family_checkout_session",
            return_value="https://checkout.stripe.com/test-session",
        ):
            response = self.client.post("/onboarding/plan/", {"plan": "family"}, follow=False)
        self.assertRedirects(
            response, "https://checkout.stripe.com/test-session", fetch_redirect_response=False,
        )

    def test_post_invalid_plan_shows_error(self):
        response = self.client.post("/onboarding/plan/", {"plan": "bogus"})
        self.assertRedirects(response, "/onboarding/plan/")
        self.account.refresh_from_db()
        self.assertFalse(self.account.onboarding_complete)

    def test_post_with_no_account_redirects_dashboard(self):
        User.objects.create_user(username="acctless", password="pass12345")
        client = Client()
        client.login(username="acctless", password="pass12345")
        response = client.post("/onboarding/plan/", {"plan": "free"})
        self.assertRedirects(response, "/dashboard/")


class OnboardingCompleteViewTestCase(TestCase):
    def test_marks_onboarding_complete_and_redirects_dashboard(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        user = User.objects.create_user(username="complete_user", password="pass12345")
        account = FamilyAccount.objects.create(name="Complete Family", slug="complete-family", owner=user)
        FamilyMembership.objects.create(account=account, user=user, role="owner")
        self.client.login(username="complete_user", password="pass12345")

        response = self.client.get("/onboarding/complete/")
        self.assertRedirects(response, "/dashboard/")

        account.refresh_from_db()
        self.assertTrue(account.onboarding_complete)

    def test_shows_upgrade_message_not_welcome_for_already_onboarded_account(self):
        """#388 fallout — an existing account upgrading later shouldn't be
        told "Welcome to Hey Famly!" as if this were their first signup."""
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        user = User.objects.create_user(username="upgrade_complete_user", password="pass12345")
        account = FamilyAccount.objects.create(
            name="Upgrade Family", slug="upgrade-family", owner=user, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=account, user=user, role="owner")
        self.client.login(username="upgrade_complete_user", password="pass12345")

        response = self.client.get("/onboarding/complete/", follow=True)
        self.assertContains(response, "now on the Family plan")
        self.assertNotContains(response, "Welcome to Hey Famly!")

    def test_sends_welcome_email_only_for_fresh_completion_not_upgrade(self):
        from django.core import mail  # noqa: PLC0415

        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        fresh_user = User.objects.create_user(
            username="fresh_complete_user", password="pass12345", email="fresh@example.com",
        )
        fresh_account = FamilyAccount.objects.create(
            name="Fresh Family", slug="fresh-family", owner=fresh_user,
        )
        FamilyMembership.objects.create(account=fresh_account, user=fresh_user, role="owner")
        self.client.login(username="fresh_complete_user", password="pass12345")
        self.client.get("/onboarding/complete/")

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Welcome to Hey Famly!")

        mail.outbox.clear()
        self.client.logout()

        upgrade_user = User.objects.create_user(
            username="upgrade_complete_user2", password="pass12345", email="upgrade2@example.com",
        )
        upgrade_account = FamilyAccount.objects.create(
            name="Upgrade Family 2", slug="upgrade-family-2b", owner=upgrade_user, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=upgrade_account, user=upgrade_user, role="owner")
        self.client.login(username="upgrade_complete_user2", password="pass12345")
        self.client.get("/onboarding/complete/")

        self.assertEqual(len(mail.outbox), 0)


class EmailVerificationTestCase(TestCase):
    """#377 — the gate only starts blocking once account.onboarding_complete
    is True, so it never interrupts the founder signup -> invite -> plan ->
    complete flow itself."""

    def setUp(self):
        from core.email_verification import email_verification_token  # noqa: PLC0415
        from core.models import EmailVerification, FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.token_gen = email_verification_token
        self.user = User.objects.create_user(
            username="verify_user", password="pass12345", email="verify@example.com",
        )
        self.account = FamilyAccount.objects.create(
            name="Verify Family", slug="verify-family", owner=self.user, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.verification = EmailVerification.objects.create(user=self.user)
        self.client.login(username="verify_user", password="pass12345")
        # login() updates last_login in the DB, which the token hash is
        # derived from — refresh so tokens built from self.user match what
        # the view will see when it re-fetches the user by pk.
        self.user.refresh_from_db()

    def _confirm_url(self):
        from django.utils.encoding import force_bytes  # noqa: PLC0415
        from django.utils.http import urlsafe_base64_encode  # noqa: PLC0415

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = self.token_gen.make_token(self.user)
        return f"/verify-email/{uid}/{token}/"

    def test_unverified_user_redirected_to_pending_page_from_dashboard(self):
        response = self.client.get("/dashboard/")
        self.assertRedirects(response, "/verify-email/")

    def test_unverified_user_can_still_reach_profile_and_pending_page(self):
        self.assertEqual(self.client.get("/profile/").status_code, 200)
        self.assertEqual(self.client.get("/verify-email/").status_code, 200)

    def test_onboarding_not_yet_complete_is_never_gated(self):
        """The gate must not fire mid-onboarding, even though the row is
        unverified — matches the explicit "allow onboarding, block after"
        decision."""
        self.account.onboarding_complete = False
        self.account.save(update_fields=["onboarding_complete"])
        response = self.client.get("/dashboard/")
        self.assertEqual(response.status_code, 200)

    def test_valid_confirm_link_verifies_and_redirects_to_dashboard(self):
        response = self.client.get(self._confirm_url(), follow=True)
        self.assertRedirects(response, "/dashboard/")
        self.verification.refresh_from_db()
        self.assertTrue(self.verification.verified)
        self.assertIsNotNone(self.verification.verified_at)

        # Gate no longer applies now that it's verified.
        self.assertEqual(self.client.get("/dashboard/").status_code, 200)

    def test_tampered_token_does_not_verify(self):
        bad_url = self._confirm_url()[:-5] + "garbage/"
        self.client.get(bad_url)
        self.verification.refresh_from_db()
        self.assertFalse(self.verification.verified)

    def test_resend_sends_another_email(self):
        from django.core import mail  # noqa: PLC0415

        response = self.client.post("/verify-email/resend/")
        self.assertRedirects(response, "/verify-email/")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["verify@example.com"])


class UpgradeToFamilyViewTestCase(TestCase):
    """#388 fallout — before this, an account that picked Free at signup had
    no way to ever reach Family-plan checkout again: OnboardingPlanView
    redirects away once onboarding_complete is True, and the Upgrade
    Required wall had no working upgrade action at all."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="upgrade_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Upgrade Family", slug="upgrade-family-2", owner=self.user, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client.login(username="upgrade_user", password="pass12345")

    def test_post_with_checkout_configured_redirects_to_stripe(self):
        from unittest.mock import patch  # noqa: PLC0415

        with patch(
            "core.views._create_family_checkout_session",
            return_value="https://checkout.stripe.com/test-session",
        ):
            response = self.client.post("/upgrade/start/", follow=False)
        self.assertRedirects(
            response, "https://checkout.stripe.com/test-session", fetch_redirect_response=False,
        )

    def test_post_with_no_price_id_configured_shows_error(self):
        response = self.client.post("/upgrade/start/")
        self.assertRedirects(response, "/upgrade/")

    def test_post_with_no_account_redirects_dashboard(self):
        User.objects.create_user(username="upgrade_acctless", password="pass12345")
        client = Client()
        client.login(username="upgrade_acctless", password="pass12345")
        response = client.post("/upgrade/start/")
        self.assertRedirects(response, "/dashboard/")

    def test_upgrade_wall_page_has_working_upgrade_button(self):
        response = self.client.get("/upgrade/")
        self.assertContains(response, "/upgrade/start/")
        self.assertContains(response, "Upgrade to Family")

    def test_profile_page_shows_upgrade_button_for_free_tier(self):
        response = self.client.get("/profile/")
        self.assertContains(response, "/upgrade/start/")
        self.assertContains(response, "Upgrade to Family")

    def test_profile_page_shows_family_status_not_upgrade_button(self):
        from core.models import FamilyAccount  # noqa: PLC0415

        self.account.tier = FamilyAccount.TIER_FAMILY
        self.account.save(update_fields=["tier"])
        response = self.client.get("/profile/")
        self.assertContains(response, "is on the")
        self.assertContains(response, "Family")
        self.assertNotContains(response, "/upgrade/start/")


class ManageSubscriptionViewTestCase(TestCase):
    """#357 — self-serve cancellation/plan-management via Stripe's hosted
    Customer Portal, replacing "email us to cancel" as the only option."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.owner = User.objects.create_user(username="portal_owner", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Portal Family", slug="portal-family", owner=self.owner, tier="family",
        )
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")

        self.member = User.objects.create_user(username="portal_member", password="pass12345")
        FamilyMembership.objects.create(account=self.account, user=self.member, role="member")

    def test_owner_post_with_portal_configured_redirects_to_stripe(self):
        from unittest.mock import patch  # noqa: PLC0415

        self.client.login(username="portal_owner", password="pass12345")
        with patch(
            "core.views._create_billing_portal_session",
            return_value="https://billing.stripe.com/test-portal-session",
        ):
            response = self.client.post("/profile/manage-subscription/", follow=False)
        self.assertRedirects(
            response, "https://billing.stripe.com/test-portal-session", fetch_redirect_response=False,
        )

    def test_owner_post_with_portal_unavailable_shows_error(self):
        # Test settings never configure Stripe — portal session stays inert.
        self.client.login(username="portal_owner", password="pass12345")
        response = self.client.post("/profile/manage-subscription/")
        self.assertRedirects(response, "/profile/")

    def test_non_owner_member_cannot_manage_subscription(self):
        self.client.login(username="portal_member", password="pass12345")
        response = self.client.post("/profile/manage-subscription/")
        self.assertRedirects(response, "/profile/")

    def test_no_account_redirects_profile(self):
        User.objects.create_user(username="portal_acctless", password="pass12345")
        client = Client()
        client.login(username="portal_acctless", password="pass12345")
        response = client.post("/profile/manage-subscription/")
        self.assertRedirects(response, "/profile/")

    def test_family_tier_profile_page_shows_manage_subscription_button(self):
        self.client.login(username="portal_owner", password="pass12345")
        response = self.client.get("/profile/")
        self.assertContains(response, "/profile/manage-subscription/")
        self.assertContains(response, "Manage Subscription")


class InvitationFlowTestCase(TestCase):
    """End-to-end: owner sends an invite, invitee clicks the link, signs up,
    and lands as a 'member' FamilyMembership on the owner's account (#310).
    No django-allauth in this app, so this also exercises the custom
    adapter/signal wiring in core/invitations_adapter.py."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.owner = User.objects.create_user(username="owner_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Invite Test Family", slug="invite-test-family", owner=self.owner,
            tier=FamilyAccount.TIER_FAMILY, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")
        self.client.login(username="owner_user", password="pass12345")

    def _accept_invite_url(self, key):
        from django.urls import reverse  # noqa: PLC0415
        return reverse("invitations:accept-invite", args=[key])

    def test_full_invite_accept_signup_flow(self):
        from core.models import FamilyMembership  # noqa: PLC0415
        from invitations.utils import get_invitation_model  # noqa: PLC0415

        Invitation = get_invitation_model()

        send_response = self.client.post("/invite/send/", {"email": "newmember@example.com"})
        self.assertRedirects(send_response, "/invite/")
        invitation = Invitation.objects.get(email="newmember@example.com")
        self.assertEqual(invitation.inviter, self.owner)
        self.assertFalse(invitation.accepted)

        # Invitee (a different, anonymous browser session) clicks the emailed link.
        invitee_client = Client()
        accept_response = invitee_client.get(self._accept_invite_url(invitation.key))
        self.assertRedirects(accept_response, "/onboarding/signup/")
        invitation.refresh_from_db()
        self.assertFalse(invitation.accepted, "clicking the link only stashes the email, doesn't accept yet")

        # Signup form should now be the invited variant, not the family-creation one.
        signup_get = invitee_client.get("/onboarding/signup/")
        self.assertContains(signup_get, "newmember@example.com")
        self.assertNotContains(signup_get, "family_name")

        signup_post = invitee_client.post(
            "/onboarding/signup/",
            {"username": "newmember", "password1": "correct horse battery staple", "password2": "correct horse battery staple"},
        )
        self.assertRedirects(signup_post, "/dashboard/")

        new_user = User.objects.get(username="newmember")
        self.assertEqual(new_user.email, "newmember@example.com")

        invitation.refresh_from_db()
        self.assertTrue(invitation.accepted)

        membership = FamilyMembership.objects.get(account=self.account, user=new_user)
        self.assertEqual(membership.role, "member")

        # Signed in and account-scoped as of the very next request.
        dashboard = invitee_client.get("/dashboard/")
        self.assertEqual(dashboard.status_code, 200)

    def test_invited_signup_get_rejects_duplicate_username(self):
        User.objects.create_user(username="taken", password="whatever123")
        invitee_client = Client()
        invitee_client.session["account_verified_email"] = "dupe@example.com"
        invitee_client.session.save()

        response = invitee_client.post(
            "/onboarding/signup/",
            {"username": "taken", "password1": "correct horse battery staple", "password2": "correct horse battery staple"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "already taken")

    def test_invited_signup_does_not_create_email_verification_row(self):
        """#377 — invited members already proved email ownership by clicking
        the invite link; they must never be gated behind a second check.

        Goes through the real send-invite -> accept-invite-link flow rather
        than poking session data directly: Client().session is a detached
        session store until a real request/response cycle sets the cookie,
        so a bare assignment + save() never actually reaches the next
        request (see test_full_invite_accept_signup_flow for the same
        pattern used correctly)."""
        from core.models import EmailVerification  # noqa: PLC0415
        from invitations.utils import get_invitation_model  # noqa: PLC0415

        Invitation = get_invitation_model()
        self.client.post("/invite/send/", {"email": "noverify@example.com"})
        invitation = Invitation.objects.get(email="noverify@example.com")

        invitee_client = Client()
        invitee_client.get(self._accept_invite_url(invitation.key))

        invitee_client.post(
            "/onboarding/signup/",
            {"username": "noverify", "password1": "correct horse battery staple", "password2": "correct horse battery staple"},
        )
        user = User.objects.get(username="noverify")
        self.assertFalse(EmailVerification.objects.filter(user=user).exists())

        # And since onboarding is already complete for the account they
        # joined (set in setUp), they must never be redirected to the gate.
        dashboard = invitee_client.get("/dashboard/")
        self.assertEqual(dashboard.status_code, 200)


class FamilyJoinNotificationTestCase(TestCase):
    """#383 — handle_invite_accepted created the FamilyMembership silently;
    now notifies the account owner that someone actually joined."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415
        from invitations.utils import get_invitation_model  # noqa: PLC0415

        Invitation = get_invitation_model()
        self.owner = User.objects.create_user(
            username="notif_owner", password="pass12345", email="owner@example.com",
        )
        self.account = FamilyAccount.objects.create(name="Notif Family", slug="notif-family", owner=self.owner)
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")
        self.new_member = User.objects.create_user(
            username="new_member", password="pass12345", email="newmember@example.com", first_name="Alex",
        )
        self.invitation = Invitation.create(email="newmember@example.com", inviter=self.owner)

    def test_invite_accepted_notifies_owner(self):
        from django.core import mail  # noqa: PLC0415

        from core.invitation_handlers import handle_invite_accepted  # noqa: PLC0415

        handle_invite_accepted(sender=None, email="newmember@example.com", invitation=self.invitation)

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["owner@example.com"])
        self.assertIn("Alex", sent.subject)
        self.assertIn("Notif Family", sent.body)

    def test_reprocessing_the_same_accept_does_not_resend(self):
        from django.core import mail  # noqa: PLC0415

        from core.invitation_handlers import handle_invite_accepted  # noqa: PLC0415

        handle_invite_accepted(sender=None, email="newmember@example.com", invitation=self.invitation)
        handle_invite_accepted(sender=None, email="newmember@example.com", invitation=self.invitation)

        self.assertEqual(len(mail.outbox), 1)

    def test_no_email_sent_when_owner_has_no_email(self):
        from django.core import mail  # noqa: PLC0415

        from core.invitation_handlers import handle_invite_accepted  # noqa: PLC0415

        self.owner.email = ""
        self.owner.save(update_fields=["email"])

        handle_invite_accepted(sender=None, email="newmember@example.com", invitation=self.invitation)

        self.assertEqual(len(mail.outbox), 0)


class SendInviteViewTestCase(TestCase):
    def setUp(self):
        from django.core.cache import cache  # noqa: PLC0415
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        # SendInviteView is rate-limited (5/min/IP) — same LocMemCache
        # persistence caveat as OnboardingSignupViewTestCase.
        cache.clear()

        self.owner = User.objects.create_user(username="cap_owner", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Cap Family", slug="cap-family", owner=self.owner, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")
        self.client.login(username="cap_owner", password="pass12345")

    def test_free_tier_blocks_invite_past_two_members(self):
        # Owner alone = 1 member; Free tier caps at 2, so exactly one more invite should succeed.
        first = self.client.post("/invite/send/", {"email": "member1@example.com"})
        self.assertRedirects(first, "/invite/")
        from invitations.utils import get_invitation_model  # noqa: PLC0415
        self.assertTrue(get_invitation_model().objects.filter(email="member1@example.com").exists())

        second = self.client.post("/invite/send/", {"email": "member2@example.com"})
        self.assertRedirects(second, "/invite/")
        self.assertFalse(get_invitation_model().objects.filter(email="member2@example.com").exists())

    def test_family_tier_allows_more_than_two_members(self):
        from core.models import FamilyAccount  # noqa: PLC0415
        self.account.tier = FamilyAccount.TIER_FAMILY
        self.account.save(update_fields=["tier"])

        for i in range(3):
            response = self.client.post("/invite/send/", {"email": f"member{i}@example.com"})
            self.assertRedirects(response, "/invite/")

        from invitations.utils import get_invitation_model  # noqa: PLC0415
        self.assertEqual(get_invitation_model().objects.count(), 3)

    def test_invalid_email_shows_error_and_redirects(self):
        response = self.client.post("/invite/send/", {"email": "not-an-email"})
        self.assertRedirects(response, "/invite/")
        from invitations.utils import get_invitation_model  # noqa: PLC0415
        self.assertEqual(get_invitation_model().objects.count(), 0)

    def test_redirects_to_onboarding_invite_when_onboarding_incomplete(self):
        self.account.onboarding_complete = False
        self.account.save(update_fields=["onboarding_complete"])
        response = self.client.post("/invite/send/", {"email": "duringonboarding@example.com"})
        self.assertRedirects(response, "/onboarding/invite/")

    def test_no_account_shows_error(self):
        User.objects.create_user(username="acctless_inviter", password="pass12345")
        client = Client()
        client.login(username="acctless_inviter", password="pass12345")
        response = client.post("/invite/send/", {"email": "whoever@example.com"})
        self.assertRedirects(response, "/invite/")


class InviteMembersViewTestCase(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415
        from invitations.utils import get_invitation_model  # noqa: PLC0415

        Invitation = get_invitation_model()
        self.owner = User.objects.create_user(username="view_owner", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="View Family", slug="view-family", owner=self.owner, onboarding_complete=True,
        )
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")
        invite = Invitation.create(email="pending@example.com", inviter=self.owner)
        invite.sent = tz.now()
        invite.save()
        self.client.login(username="view_owner", password="pass12345")

    def test_shows_members_and_pending_invites(self):
        response = self.client.get("/invite/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "view_owner")
        self.assertContains(response, "pending@example.com")


class ProfileViewTestCase(TestCase):
    """#312/#314 — name/email edit, scoped to the logged-in user only."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="profile_user", password="pass12345",
            first_name="Pat", last_name="Original", email="pat@example.com",
        )
        self.other_user = User.objects.create_user(
            username="other_profile_user", password="pass12345", email="other@example.com",
        )
        self.client.login(username="profile_user", password="pass12345")

    def test_get_shows_current_values(self):
        response = self.client.get("/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Pat")
        self.assertContains(response, "pat@example.com")

    def test_post_updates_own_profile(self):
        response = self.client.post(
            "/profile/",
            {"first_name": "Patricia", "last_name": "Updated", "email": "patricia@example.com"},
        )
        self.assertRedirects(response, "/profile/")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Patricia")
        self.assertEqual(self.user.last_name, "Updated")
        self.assertEqual(self.user.email, "patricia@example.com")

    def test_post_does_not_affect_other_users(self):
        self.client.post(
            "/profile/",
            {"first_name": "Patricia", "last_name": "Updated", "email": "patricia@example.com"},
        )
        self.other_user.refresh_from_db()
        self.assertEqual(self.other_user.email, "other@example.com")

    def test_post_duplicate_email_rejected(self):
        response = self.client.post(
            "/profile/",
            {"first_name": "Pat", "last_name": "Original", "email": "other@example.com"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Another account is already using that email")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "pat@example.com")

    def test_keeping_own_email_is_not_a_duplicate(self):
        response = self.client.post(
            "/profile/",
            {"first_name": "Pat", "last_name": "Original", "email": "pat@example.com"},
        )
        self.assertRedirects(response, "/profile/")


class PasswordChangeTestCase(TestCase):
    """Wired via core.views.StyledPasswordChangeView (#312) — styled
    override of Django's built-in PasswordChangeView."""

    def setUp(self):
        self.user = User.objects.create_user(username="pwd_user", password="original-pass-123")
        self.client.login(username="pwd_user", password="original-pass-123")

    def test_correct_old_password_changes_it(self):
        response = self.client.post(
            "/accounts/password_change/",
            {
                "old_password": "original-pass-123",
                "new_password1": "a much better new password 456",
                "new_password2": "a much better new password 456",
            },
        )
        self.assertRedirects(response, "/accounts/password_change/done/")
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("a much better new password 456"))

    def test_wrong_old_password_rejected(self):
        response = self.client.post(
            "/accounts/password_change/",
            {
                "old_password": "totally-wrong-password",
                "new_password1": "a much better new password 456",
                "new_password2": "a much better new password 456",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("original-pass-123"))

    def test_successful_change_sends_confirmation_email(self):
        """#379 — a signal to the real owner if an attacker changes a
        compromised account's password."""
        from django.core import mail  # noqa: PLC0415

        self.user.email = "pwd_user@example.com"
        self.user.save(update_fields=["email"])

        self.client.post(
            "/accounts/password_change/",
            {
                "old_password": "original-pass-123",
                "new_password1": "a much better new password 456",
                "new_password2": "a much better new password 456",
            },
        )
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["pwd_user@example.com"])
        self.assertIn("password was changed", sent.subject)

    def test_wrong_old_password_does_not_send_email(self):
        from django.core import mail  # noqa: PLC0415

        self.client.post(
            "/accounts/password_change/",
            {
                "old_password": "totally-wrong-password",
                "new_password1": "a much better new password 456",
                "new_password2": "a much better new password 456",
            },
        )
        self.assertEqual(len(mail.outbox), 0)


class PasswordResetConfirmEmailTestCase(TestCase):
    """#379 — the reset-confirm side of the same confirmation email, wired
    via core.views.StyledPasswordResetConfirmView so it wins the
    `password_reset_confirm` URL name ahead of django.contrib.auth.urls."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="reset_confirm_user", password="original-pass-123", email="reset_confirm@example.com",
        )

    def test_completing_reset_sends_confirmation_email(self):
        from django.contrib.auth.tokens import default_token_generator  # noqa: PLC0415
        from django.core import mail  # noqa: PLC0415
        from django.utils.encoding import force_bytes  # noqa: PLC0415
        from django.utils.http import urlsafe_base64_encode  # noqa: PLC0415

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        # First GET exchanges the emailed token for a session-scoped one and
        # redirects to the .../set-password/ URL, mirroring what a browser
        # actually does — this also proves our override didn't break that.
        follow_response = self.client.get(f"/accounts/reset/{uid}/{token}/", follow=True)
        set_password_url = follow_response.redirect_chain[-1][0]

        self.client.post(
            set_password_url,
            {"new_password1": "a much better new password 456", "new_password2": "a much better new password 456"},
        )

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("a much better new password 456"))
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["reset_confirm@example.com"])
        self.assertIn("password was changed", sent.subject)


class PasswordResetEmailTestCase(TestCase):
    """Django's default reset email/subject templates are generic and
    unbranded ("Password reset on heyfamlyapp.com", "the heyfamlyapp.com
    team") — templates/registration/password_reset_email.html and
    password_reset_subject.txt override them to match the app's voice."""

    def test_reset_email_is_branded_not_generic_django_default(self):
        from django.core import mail  # noqa: PLC0415

        User.objects.create_user(username="reset_user", password="pass12345", email="reset@example.com")
        self.client.post("/accounts/password_reset/", {"email": "reset@example.com"})

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.subject, "Reset your Hey Famly password")
        self.assertIn("Hey Famly", sent.body)
        self.assertIn("/accounts/reset/", sent.body)  # sanity: reset link actually present
        self.assertNotIn("Thanks for using our site!", sent.body)
        self.assertNotIn("team", sent.body)


class LandingPageViewTestCase(TestCase):
    """#315 — public marketing page at `/`, root no longer requires login."""

    def test_anonymous_get_returns_200_with_marketing_copy(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "One Place for Everything Your Family Runs On")

    def test_start_free_links_to_onboarding_signup(self):
        response = self.client.get("/")
        self.assertContains(response, "/onboarding/signup/")

    def test_family_card_subscribes_directly_not_start_free(self):
        """#388 fallout — the $4.99 card previously said "Start Free" (a
        copy-paste leftover) and carried no plan intent through signup."""
        response = self.client.get("/")
        self.assertContains(response, "/onboarding/signup/?plan=family")
        self.assertContains(response, "Subscribe")

    def test_authenticated_user_redirected_to_dashboard(self):
        User.objects.create_user(username="landing_user", password="pass12345")
        self.client.login(username="landing_user", password="pass12345")
        response = self.client.get("/")
        self.assertRedirects(response, "/dashboard/")

    def test_structured_data_reflects_real_tiers_only(self):
        """#334 — must match core.models.FamilyAccount.TIER_CHOICES exactly;
        no invented "Premium" tier that doesn't exist in the app."""
        response = self.client.get("/")
        self.assertContains(response, "application/ld+json")
        self.assertContains(response, '"name": "Free"')
        self.assertContains(response, '"name": "Family"')
        self.assertContains(response, '"price": "4.99"')
        self.assertNotContains(response, "Premium")
        self.assertNotContains(response, "9.99")

    def test_open_graph_tags_present(self):
        response = self.client.get("/")
        self.assertContains(response, 'property="og:title"')
        self.assertContains(response, 'property="og:image"')
        self.assertContains(response, "https://heyfamlyapp.com/static/img/logo.jpg")


class RobotsAndSitemapTestCase(TestCase):
    """#337 — technical SEO plumbing: robots.txt disallows the login-walled
    app, sitemap.xml lists only the public URLs that actually exist."""

    def test_robots_txt_allows_public_pages_and_disallows_app(self):
        response = self.client.get("/robots.txt")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain")
        self.assertContains(response, "Disallow: /dashboard/")
        self.assertContains(response, "Disallow: /admin/")
        self.assertContains(response, "Sitemap: https://heyfamlyapp.com/sitemap.xml")
        self.assertNotContains(response, "Disallow: /$")

    def test_sitemap_xml_lists_only_real_public_urls(self):
        response = self.client.get("/sitemap.xml")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml")
        self.assertContains(response, "<loc>https://heyfamlyapp.com/</loc>")
        self.assertContains(response, "<loc>https://heyfamlyapp.com/privacy/</loc>")
        self.assertContains(response, "<loc>https://heyfamlyapp.com/terms/</loc>")


class UmamiAnalyticsTestCase(TestCase):
    """#358 — the landing page's tracking script stays unrendered until
    UMAMI_WEBSITE_ID is configured (inert-until-configured, same pattern as
    Stripe checkout)."""

    def test_script_absent_when_not_configured(self):
        response = self.client.get("/")
        self.assertNotContains(response, "analytics.heyfamlyapp.com/script.js")

    @override_settings(UMAMI_WEBSITE_ID="test-uuid-1234")
    def test_script_present_when_configured(self):
        response = self.client.get("/")
        self.assertContains(response, "analytics.heyfamlyapp.com/script.js")
        self.assertContains(response, 'data-website-id="test-uuid-1234"')


class LegalPagesTestCase(TestCase):
    """#318/#321 — Privacy Policy and Terms of Service, viewable whether
    logged in or not, linked from the landing page and onboarding's plan
    step."""

    def test_privacy_policy_reachable_anonymously(self):
        response = self.client.get("/privacy/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Privacy Policy")
        self.assertContains(response, "Stripe")
        self.assertContains(response, "cnickerson@oakcitysoftwaresolutions.com")

    def test_terms_of_service_reachable_anonymously(self):
        response = self.client.get("/terms/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Terms of Service")
        self.assertContains(response, "North Carolina")

    def test_legal_pages_reachable_when_authenticated(self):
        User.objects.create_user(username="legal_user", password="pass12345")
        self.client.login(username="legal_user", password="pass12345")
        self.assertEqual(self.client.get("/privacy/").status_code, 200)
        self.assertEqual(self.client.get("/terms/").status_code, 200)

    def test_landing_page_links_to_both(self):
        response = self.client.get("/")
        self.assertContains(response, "/privacy/")
        self.assertContains(response, "/terms/")

    def test_onboarding_plan_links_to_both(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        user = User.objects.create_user(username="plan_legal_user", password="pass12345")
        account = FamilyAccount.objects.create(name="Legal Family", slug="legal-family", owner=user)
        FamilyMembership.objects.create(account=account, user=user, role="owner")
        self.client.login(username="plan_legal_user", password="pass12345")

        response = self.client.get("/onboarding/plan/")
        self.assertContains(response, "/privacy/")
        self.assertContains(response, "/terms/")


class DataExportViewTestCase(TestCase):
    """#319 — account owner downloads a ZIP of CSVs; non-owners can't."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415
        from vehicles.models import Vehicle  # noqa: PLC0415

        self.owner = User.objects.create_user(username="export_owner", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Export Family", slug="export-family", owner=self.owner,
        )
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")

        self.member = User.objects.create_user(username="export_member", password="pass12345")
        FamilyMembership.objects.create(account=self.account, user=self.member, role="member")

        Vehicle.objects.create(
            account=self.account, year=2021, make="Toyota", model="RAV4", vin="1HGCM82633A004998",
            color="Red", license_plate="ABC123", current_mileage=5000,
            registration_expiry=date.today() + timedelta(days=365),
        )

    def test_owner_downloads_zip_containing_their_data(self):
        import zipfile
        from io import BytesIO

        self.client.login(username="export_owner", password="pass12345")
        response = self.client.get("/profile/export/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/zip")
        self.assertIn("export-family-data-export-", response["Content-Disposition"])

        with zipfile.ZipFile(BytesIO(response.content)) as zf:
            names = zf.namelist()
            self.assertIn("vehicles.csv", names)
            vehicles_csv = zf.read("vehicles.csv").decode("utf-8")
            self.assertIn("1HGCM82633A004998", vehicles_csv)

    def test_non_owner_member_cannot_export(self):
        self.client.login(username="export_member", password="pass12345")
        response = self.client.get("/profile/export/")
        self.assertRedirects(response, "/profile/")

    def test_user_with_no_account_cannot_export(self):
        User.objects.create_user(username="export_no_account", password="pass12345")
        self.client.login(username="export_no_account", password="pass12345")
        response = self.client.get("/profile/export/")
        self.assertRedirects(response, "/profile/")


class AccountDeleteViewTestCase(TestCase):
    """#320 — right-to-erasure: owner-only, password-confirmed, immediate
    hard delete that cascades to every account-scoped model."""

    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415
        from vehicles.models import Vehicle  # noqa: PLC0415

        self.owner = User.objects.create_user(username="delete_owner", password="original-pass-123")
        self.account = FamilyAccount.objects.create(
            name="Delete Family", slug="delete-family", owner=self.owner,
        )
        FamilyMembership.objects.create(account=self.account, user=self.owner, role="owner")

        self.member = User.objects.create_user(username="delete_member", password="pass12345")
        FamilyMembership.objects.create(account=self.account, user=self.member, role="member")

        self.vehicle = Vehicle.objects.create(
            account=self.account, year=2019, make="Ford", model="F-150", vin="1HGCM82633A004997",
            color="Black", license_plate="DEL123", current_mileage=20000,
            registration_expiry=date.today() + timedelta(days=365),
        )

    def test_get_confirm_page_as_owner(self):
        self.client.login(username="delete_owner", password="original-pass-123")
        response = self.client.get("/profile/delete/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Permanently delete")

    def test_non_owner_member_cannot_reach_confirm_page(self):
        self.client.login(username="delete_member", password="pass12345")
        response = self.client.get("/profile/delete/")
        self.assertRedirects(response, "/profile/")

    def test_wrong_password_does_not_delete(self):
        from core.models import FamilyAccount  # noqa: PLC0415

        self.client.login(username="delete_owner", password="original-pass-123")
        response = self.client.post("/profile/delete/", {"password": "totally-wrong"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Incorrect password")
        self.assertTrue(FamilyAccount.objects.filter(pk=self.account.pk).exists())

    def test_correct_password_deletes_account_and_cascades(self):
        from unittest.mock import patch  # noqa: PLC0415

        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415
        from vehicles.models import Vehicle  # noqa: PLC0415

        self.client.login(username="delete_owner", password="original-pass-123")
        with patch("core.views._cancel_active_subscriptions") as mock_cancel:
            response = self.client.post("/profile/delete/", {"password": "original-pass-123"})

        # account.delete() clears .pk on the in-memory object afterward, so
        # compare identity via slug/name rather than relying on Model.__eq__
        # (which is pk-based) against the same object the mock captured.
        mock_cancel.assert_called_once()
        self.assertEqual(mock_cancel.call_args.args[0].slug, "delete-family")
        self.assertRedirects(response, "/")
        self.assertFalse(FamilyAccount.objects.filter(pk=self.account.pk).exists())
        self.assertFalse(Vehicle.objects.filter(pk=self.vehicle.pk).exists())
        self.assertFalse(FamilyMembership.objects.filter(account_id=self.account.pk).exists())

        # The owner and member Users themselves are not deleted — only the
        # FamilyAccount and its cascading data.
        self.assertTrue(User.objects.filter(pk=self.owner.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())

    def test_owner_is_logged_out_after_deletion(self):
        self.client.login(username="delete_owner", password="original-pass-123")
        self.client.post("/profile/delete/", {"password": "original-pass-123"})
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_cancel_active_subscriptions_noop_without_stripe_configured(self):
        """No STRIPE_*_SECRET_KEY in test settings — must not raise."""
        from core.views import _cancel_active_subscriptions  # noqa: PLC0415

        _cancel_active_subscriptions(self.account)

    def test_successful_deletion_sends_confirmation_email(self):
        """#380 — sent before the account/its email are actually gone."""
        from django.core import mail  # noqa: PLC0415

        self.owner.email = "delete_owner@example.com"
        self.owner.save(update_fields=["email"])

        self.client.login(username="delete_owner", password="original-pass-123")
        self.client.post("/profile/delete/", {"password": "original-pass-123"})

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["delete_owner@example.com"])
        self.assertIn("Delete Family", sent.subject)
        self.assertIn("permanently deleted", sent.body)

    def test_wrong_password_does_not_send_email(self):
        from django.core import mail  # noqa: PLC0415

        self.client.login(username="delete_owner", password="original-pass-123")
        self.client.post("/profile/delete/", {"password": "totally-wrong"})
        self.assertEqual(len(mail.outbox), 0)
