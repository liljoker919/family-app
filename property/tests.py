from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from property.models import Guest, GuestBooking, MaintenanceProject, Property, PropertyTransaction

User = get_user_model()


class MaintenanceRecurrenceTest(TestCase):
    def setUp(self):
        self.prop = Property.objects.create(
            name="Test House",
            address="123 Main St",
            property_type="single_family",
        )

    def _make_project(self, **kwargs):
        defaults = {
            "prop": self.prop,
            "title": "HVAC Filter",
            "category": "HVAC",
            "status": "planned",
            "priority": "medium",
            "frequency_months": 3,
        }
        defaults.update(kwargs)
        return MaintenanceProject.objects.create(**defaults)

    def _complete(self, project, on=None):
        project.status = "completed"
        project.completion_date = on or date(2026, 1, 15)
        project.save()

    # ── Happy path ────────────────────────────────────────────────────────────

    def test_completing_recurring_task_creates_one_new_task(self):
        project = self._make_project()
        self._complete(project, on=date(2026, 1, 15))
        self.assertEqual(MaintenanceProject.objects.count(), 2)

    def test_new_task_due_date_is_base_plus_frequency(self):
        project = self._make_project(frequency_months=3)
        self._complete(project, on=date(2026, 1, 15))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.due_date, date(2026, 4, 15))

    def test_new_task_inherits_title_category_priority_and_frequency(self):
        project = self._make_project(frequency_months=6, priority="high", category="PLUMBING")
        self._complete(project, on=date(2026, 1, 1))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.title, project.title)
        self.assertEqual(new.category, "PLUMBING")
        self.assertEqual(new.priority, "high")
        self.assertEqual(new.frequency_months, 6)

    def test_new_task_status_is_planned(self):
        project = self._make_project()
        self._complete(project, on=date(2026, 1, 1))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.status, "planned")

    def test_frequency_crosses_year_boundary(self):
        project = self._make_project(frequency_months=3)
        self._complete(project, on=date(2025, 11, 15))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.due_date, date(2026, 2, 15))

    # ── Month-end clamping ────────────────────────────────────────────────────

    def test_jan31_plus_1_month_clamps_to_feb28(self):
        project = self._make_project(frequency_months=1)
        self._complete(project, on=date(2026, 1, 31))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.due_date, date(2026, 2, 28))

    def test_jan31_plus_1_month_clamps_to_feb29_in_leap_year(self):
        project = self._make_project(frequency_months=1)
        self._complete(project, on=date(2024, 1, 31))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.due_date, date(2024, 2, 29))

    def test_jan31_plus_3_months_is_apr30(self):
        project = self._make_project(frequency_months=3)
        self._complete(project, on=date(2026, 1, 31))
        new = MaintenanceProject.objects.filter(status="planned").get()
        self.assertEqual(new.due_date, date(2026, 4, 30))

    # ── No-recurrence cases ───────────────────────────────────────────────────

    def test_no_recurrence_when_frequency_months_is_null(self):
        project = self._make_project(frequency_months=None)
        self._complete(project, on=date(2026, 1, 1))
        self.assertEqual(MaintenanceProject.objects.count(), 1)

    def test_no_duplicate_when_saving_already_completed_project(self):
        project = self._make_project()
        self._complete(project, on=date(2026, 1, 1))
        self.assertEqual(MaintenanceProject.objects.count(), 2)
        # Save the completed project again — should NOT create another
        project.save()
        self.assertEqual(MaintenanceProject.objects.count(), 2)

    def test_falls_back_to_today_when_no_completion_date_set(self):
        project = self._make_project(frequency_months=1)
        project.status = "completed"
        # completion_date intentionally not set
        project.save()
        self.assertEqual(MaintenanceProject.objects.count(), 2)


class GuestBookingComputedFieldsTest(TestCase):
    def setUp(self):
        self.prop = Property.objects.create(name="Steps to the Sea", address="111 SE 1st St")
        self.guest = Guest.objects.create(name="Sarah Bradley", email="sbradley1204@gmail.com")

    def _make_booking(self, **kwargs):
        defaults = {
            "prop": self.prop,
            "guest": self.guest,
            "source": "VRBO",
            "start_date": date(2026, 6, 20),
            "end_date": date(2026, 6, 27),
            "total_cost": Decimal("2102.94"),
        }
        defaults.update(kwargs)
        return GuestBooking.objects.create(**defaults)

    def test_nights_is_date_delta(self):
        booking = self._make_booking()
        self.assertEqual(booking.nights, 7)

    def test_per_night_price_divides_total_by_nights(self):
        booking = self._make_booking()
        self.assertEqual(booking.per_night_price, Decimal("2102.94") / 7)

    def test_per_night_price_is_zero_for_same_day_booking(self):
        booking = self._make_booking(start_date=date(2026, 6, 20), end_date=date(2026, 6, 20))
        self.assertEqual(booking.per_night_price, Decimal("0"))


class GuestBookingTransactionSyncTest(TestCase):
    def setUp(self):
        self.prop = Property.objects.create(name="Steps to the Sea", address="111 SE 1st St")
        self.guest = Guest.objects.create(name="Sarah Bradley", email="sbradley1204@gmail.com")

    def _make_booking(self, **kwargs):
        defaults = {
            "prop": self.prop,
            "guest": self.guest,
            "source": "VRBO",
            "start_date": date(2026, 6, 20),
            "end_date": date(2026, 6, 27),
            "total_cost": Decimal("2102.94"),
        }
        defaults.update(kwargs)
        return GuestBooking.objects.create(**defaults)

    def test_creating_booking_creates_one_linked_transaction(self):
        booking = self._make_booking()
        self.assertEqual(PropertyTransaction.objects.count(), 1)
        txn = PropertyTransaction.objects.get()
        self.assertEqual(booking.transaction_id, txn.pk)

    def test_linked_transaction_has_rent_income_category(self):
        booking = self._make_booking()
        self.assertEqual(booking.transaction.category, "RENT_INCOME")

    def test_linked_transaction_amount_matches_total_cost(self):
        booking = self._make_booking()
        self.assertEqual(booking.transaction.amount, Decimal("2102.94"))

    def test_linked_transaction_description_includes_source_and_guest(self):
        booking = self._make_booking()
        self.assertEqual(booking.transaction.description, "VRBO - Sarah Bradley")

    def test_linked_transaction_date_matches_start_date(self):
        booking = self._make_booking()
        self.assertEqual(booking.transaction.date, date(2026, 6, 20))

    def test_editing_total_cost_updates_same_transaction_no_duplicate(self):
        booking = self._make_booking()
        txn_id = booking.transaction_id
        booking.total_cost = Decimal("2200.00")
        booking.save()
        self.assertEqual(PropertyTransaction.objects.count(), 1)
        self.assertEqual(booking.transaction_id, txn_id)
        booking.transaction.refresh_from_db()
        self.assertEqual(booking.transaction.amount, Decimal("2200.00"))

    def test_editing_source_updates_transaction_description(self):
        booking = self._make_booking(source="VRBO")
        booking.source = "DIRECT"
        booking.save()
        booking.transaction.refresh_from_db()
        self.assertEqual(booking.transaction.description, "Direct - Sarah Bradley")

    def test_deleting_booking_deletes_linked_transaction(self):
        booking = self._make_booking()
        txn_id = booking.transaction_id
        booking.delete()
        self.assertFalse(PropertyTransaction.objects.filter(pk=txn_id).exists())

    def test_property_calculate_totals_reflects_booking_income(self):
        self._make_booking()
        totals = self.prop.calculate_totals(year=2026)
        self.assertEqual(totals["income"], Decimal("2102.94"))


class GuestViewsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pass")
        self.client = Client()
        self.client.login(username="owner", password="pass")
        self.guest = Guest.objects.create(name="Sarah Bradley", email="sbradley1204@gmail.com")

    def test_list_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("property:guest_list"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_list_returns_200_and_lists_guests(self):
        response = self.client.get(reverse("property:guest_list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sarah Bradley")

    def test_search_filters_by_name(self):
        Guest.objects.create(name="Justin Bland", email=None)
        response = self.client.get(reverse("property:guest_list"), {"q": "Sarah"})
        self.assertContains(response, "Sarah Bradley")
        self.assertNotContains(response, "Justin Bland")

    def test_create_adds_guest_and_redirects(self):
        response = self.client.post(
            reverse("property:guest_create"),
            {"name": "New Guest", "email": "new@example.com", "phone": "", "notes": ""},
        )
        self.assertRedirects(response, reverse("property:guest_list"))
        self.assertTrue(Guest.objects.filter(name="New Guest").exists())

    def test_create_requires_login(self):
        self.client.logout()
        response = self.client.post(
            reverse("property:guest_create"),
            {"name": "New Guest", "email": "", "phone": "", "notes": ""},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_update_changes_name_and_redirects(self):
        response = self.client.post(
            reverse("property:guest_update", kwargs={"pk": self.guest.pk}),
            {"name": "Sarah B. Updated", "email": self.guest.email, "phone": "", "notes": ""},
        )
        self.assertRedirects(response, reverse("property:guest_list"))
        self.guest.refresh_from_db()
        self.assertEqual(self.guest.name, "Sarah B. Updated")

    def test_delete_removes_guest_and_redirects(self):
        response = self.client.post(reverse("property:guest_delete", kwargs={"pk": self.guest.pk}))
        self.assertRedirects(response, reverse("property:guest_list"))
        self.assertFalse(Guest.objects.filter(pk=self.guest.pk).exists())


class BookingViewsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner2", password="pass")
        self.client = Client()
        self.client.login(username="owner2", password="pass")
        self.prop = Property.objects.create(name="Steps to the Sea", address="111 SE 1st St")
        self.guest = Guest.objects.create(name="Sarah Bradley", email="sbradley1204@gmail.com")
        self.booking = GuestBooking.objects.create(
            prop=self.prop, guest=self.guest, source="VRBO",
            start_date=date(2026, 6, 20), end_date=date(2026, 6, 27),
            total_cost=Decimal("2102.94"),
        )

    def test_property_detail_bookings_tab_lists_booking(self):
        response = self.client.get(reverse("property:property_detail", kwargs={"pk": self.prop.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sarah Bradley")

    def test_create_requires_login(self):
        self.client.logout()
        response = self.client.post(
            reverse("property:booking_create", kwargs={"property_pk": self.prop.pk}),
            {
                "guest": self.guest.pk, "source": "VRBO",
                "start_date": "2026-07-01", "end_date": "2026-07-05",
                "total_cost": "800.00", "deposit_received": "", "balance_received": "",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_create_adds_booking_and_syncs_transaction(self):
        response = self.client.post(
            reverse("property:booking_create", kwargs={"property_pk": self.prop.pk}),
            {
                "guest": self.guest.pk, "source": "DIRECT",
                "start_date": "2026-07-01", "end_date": "2026-07-05",
                "total_cost": "800.00", "deposit_received": "", "balance_received": "",
            },
        )
        self.assertRedirects(
            response,
            reverse("property:property_detail", kwargs={"pk": self.prop.pk}) + "?tab=bookings",
        )
        new_booking = GuestBooking.objects.get(source="DIRECT")
        self.assertEqual(new_booking.transaction.amount, Decimal("800.00"))

    def test_update_changes_total_cost_and_syncs_transaction(self):
        response = self.client.post(
            reverse("property:booking_update", kwargs={"pk": self.booking.pk}),
            {
                "guest": self.guest.pk, "source": "VRBO",
                "start_date": "2026-06-20", "end_date": "2026-06-27",
                "total_cost": "2200.00", "deposit_received": "", "balance_received": "",
            },
        )
        self.assertRedirects(
            response,
            reverse("property:property_detail", kwargs={"pk": self.prop.pk}) + "?tab=bookings",
        )
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.transaction.amount, Decimal("2200.00"))

    def test_delete_removes_booking_and_transaction(self):
        txn_id = self.booking.transaction_id
        response = self.client.post(reverse("property:booking_delete", kwargs={"pk": self.booking.pk}))
        self.assertRedirects(
            response,
            reverse("property:property_detail", kwargs={"pk": self.prop.pk}) + "?tab=bookings",
        )
        self.assertFalse(GuestBooking.objects.filter(pk=self.booking.pk).exists())
        self.assertFalse(PropertyTransaction.objects.filter(pk=txn_id).exists())
