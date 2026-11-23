from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from core.data_export import build_export_zip
from core.models import FamilyAccount, FamilyMembership

from .forms import ReservationForm
from .models import Reservation, Vacation
from .reservation_types import RESERVATION_TYPE_FIELDS, get_type_config

User = get_user_model()
TZ = ZoneInfo("America/New_York")


def _dt(day, hour=12, minute=0):
    return datetime(2026, 3, day, hour, minute, tzinfo=TZ)


class ReservationTypeConfigTestCase(TestCase):
    def test_flight_labels(self):
        labels = get_type_config("FLIGHT")["labels"]
        self.assertEqual(labels["provider"], "Airline")
        self.assertEqual(labels["departure_time"], "Departure time")
        self.assertEqual(labels["arrival_time"], "Arrival time")

    def test_hotel_labels_cover_rentals(self):
        cfg = get_type_config("HOTEL")
        self.assertEqual(cfg["labels"]["provider"], "Hotel or platform")
        self.assertEqual(cfg["labels"]["confirmation_number"], "Confirmation / reservation code")
        self.assertEqual(cfg["labels"]["departure_time"], "Check-in")
        self.assertEqual(cfg["labels"]["arrival_time"], "Check-out")
        self.assertEqual(cfg["labels"]["room_type"], "Room / unit type")
        self.assertIn("Airbnb", cfg["placeholders"]["provider"])
        self.assertEqual(
            cfg["extra_fields"],
            ["property_name", "address", "room_type", "host_name", "host_phone", "listing_url"],
        )
        self.assertEqual(cfg["default_times"], {"departure_time": "15:00", "arrival_time": "11:00"})

    def test_car_labels(self):
        cfg = get_type_config("CAR")
        self.assertEqual(cfg["labels"]["provider"], "Rental company")
        self.assertEqual(cfg["labels"]["departure_time"], "Pick-up time")
        self.assertEqual(cfg["labels"]["arrival_time"], "Drop-off time")
        self.assertEqual(cfg["extra_fields"], ["pickup_location", "dropoff_location", "vehicle_class"])

    def test_unmapped_types_fall_back_to_generic(self):
        for type_value in ("OTHER", "", None, "SOMETHING_NEW"):
            cfg = get_type_config(type_value)
            self.assertEqual(cfg["labels"]["provider"], "Provider")
            self.assertEqual(cfg["labels"]["departure_time"], "Start time")
            self.assertEqual(cfg["extra_fields"], [])

    def test_every_type_keeps_base_fields_required(self):
        for type_value in [*RESERVATION_TYPE_FIELDS, "OTHER"]:
            required = get_type_config(type_value)["required"]
            for name in ("type", "provider", "confirmation_number", "departure_time", "arrival_time"):
                self.assertIn(name, required, f"{type_value}: {name}")

    def test_get_type_config_returns_a_copy(self):
        get_type_config("HOTEL")["labels"]["provider"] = "mutated"
        self.assertEqual(get_type_config("HOTEL")["labels"]["provider"], "Hotel or platform")

    def test_hotel_choice_label_keeps_stored_value(self):
        self.assertIn(("HOTEL", "Hotel / Rental"), Reservation.TYPE_CHOICES)


class ReservationFormLabelTestCase(TestCase):
    def test_unbound_form_uses_initial_type_labels(self):
        form = ReservationForm(initial={"type": "CAR"})
        self.assertEqual(form.fields["departure_time"].label, "Pick-up time")
        self.assertEqual(form.fields["provider"].widget.attrs["placeholder"], "e.g. Enterprise")

    def test_bound_form_uses_submitted_type_labels(self):
        form = ReservationForm(data={"type": "HOTEL"})
        self.assertEqual(form.fields["departure_time"].label, "Check-in")
        self.assertEqual(form.fields["notes"].widget.attrs["placeholder"], "Check-in instructions, Wi-Fi, parking…")

    def test_extra_fields_hidden_for_other_types(self):
        form = ReservationForm(initial={"type": "FLIGHT"})
        hidden = {row["field"].name for row in form.rows if row["hidden"]}
        self.assertNotIn("flight_number", hidden)
        self.assertIn("listing_url", hidden)
        self.assertIn("pickup_location", hidden)

    def test_field_names_unchanged(self):
        form = ReservationForm()
        for name in ("type", "provider", "confirmation_number", "departure_time", "arrival_time", "notes"):
            self.assertIn(name, form.fields)


class ReservationViewTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="res_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family R", slug="family-r", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.vacation = Vacation.objects.create(
            account=self.account, name="Orlando 2026", destination="Orlando, FL",
            start_date=date(2026, 3, 4), end_date=date(2026, 3, 8),
        )
        self.client.login(username="res_user", password="pass12345")
        self.create_url = reverse("vacations:reservation_create", kwargs={"vacation_pk": self.vacation.pk})
        self.detail_url = reverse("vacations:vacation_detail", kwargs={"pk": self.vacation.pk}) + "?tab=reservations"

    @staticmethod
    def old_payload(type_value, **overrides):
        """The POST shape from before this change: base fields only."""
        payload = {
            "type": type_value,
            "provider": "Hilton",
            "confirmation_number": "ABC123",
            "departure_time": "2026-03-04T15:00",
            "arrival_time": "2026-03-08T11:00",
            "notes": "",
        }
        payload.update(overrides)
        return payload

    def make(self, **kwargs):
        defaults = dict(
            vacation=self.vacation, type="HOTEL", provider="Hilton", confirmation_number="H1",
            departure_time=_dt(4, 15), arrival_time=_dt(8, 11),
        )
        defaults.update(kwargs)
        return Reservation.objects.create(**defaults)


class ReservationValidationTestCase(ReservationViewTestBase):
    def _assert_order_error(self, type_value, message):
        response = self.client.post(
            self.create_url,
            self.old_payload(type_value, departure_time="2026-03-08T11:00", arrival_time="2026-03-04T15:00"),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["form"].errors["arrival_time"], [message])
        self.assertFalse(Reservation.objects.exists())

    def test_hotel_end_before_start(self):
        self._assert_order_error("HOTEL", "Check-out must be after check-in.")

    def test_car_end_before_start(self):
        self._assert_order_error("CAR", "Drop-off time must be after pick-up time.")

    def test_flight_end_before_start(self):
        self._assert_order_error("FLIGHT", "Arrival time must be after departure time.")

    def test_other_end_before_start(self):
        self._assert_order_error("OTHER", "End time must be after start time.")

    def test_equal_times_rejected_on_create(self):
        response = self.client.post(
            self.create_url,
            self.old_payload("CAR", departure_time="2026-03-04T10:00", arrival_time="2026-03-04T10:00"),
        )
        self.assertIn("arrival_time", response.context["form"].errors)

    def test_order_rule_not_applied_when_editing_existing(self):
        # Pre-existing bad data must not start failing validation on edit.
        res = self.make(departure_time=_dt(8, 11), arrival_time=_dt(4, 15))
        response = self.client.post(
            reverse("vacations:reservation_update", kwargs={"pk": res.pk}),
            self.old_payload("HOTEL", provider="Marriott", departure_time="2026-03-08T11:00", arrival_time="2026-03-04T15:00"),
        )
        self.assertRedirects(response, self.detail_url)
        res.refresh_from_db()
        self.assertEqual(res.provider, "Marriott")

    def test_base_fields_still_required(self):
        response = self.client.post(self.create_url, {"type": "HOTEL"})
        errors = response.context["form"].errors
        for name in ("provider", "confirmation_number", "departure_time", "arrival_time"):
            self.assertIn(name, errors)


class ReservationOldPayloadTestCase(ReservationViewTestBase):
    """Clients sending the pre-change payload (no new fields) keep working."""

    def test_old_payload_creates_each_type(self):
        for type_value in ("FLIGHT", "HOTEL", "CAR", "OTHER"):
            response = self.client.post(self.create_url, self.old_payload(type_value, confirmation_number=type_value))
            self.assertRedirects(response, self.detail_url)
            res = Reservation.objects.get(confirmation_number=type_value)
            self.assertEqual(res.type, type_value)
            self.assertEqual(res.provider, "Hilton")
            self.assertEqual(res.property_name, "")

    def test_old_payload_hotel_create_and_update(self):
        self.client.post(self.create_url, self.old_payload("HOTEL"))
        res = Reservation.objects.get()
        response = self.client.post(
            reverse("vacations:reservation_update", kwargs={"pk": res.pk}),
            self.old_payload("HOTEL", provider="Hyatt", notes="Late check-in"),
        )
        self.assertRedirects(response, self.detail_url)
        res.refresh_from_db()
        self.assertEqual(res.type, "HOTEL")
        self.assertEqual(res.provider, "Hyatt")
        self.assertEqual(res.notes, "Late check-in")

    def test_old_payload_update_keeps_same_type_extras(self):
        res = self.make(property_name="Lakeside 3BR", host_name="Maria")
        self.client.post(
            reverse("vacations:reservation_update", kwargs={"pk": res.pk}),
            self.old_payload("HOTEL", provider="Airbnb"),
        )
        res.refresh_from_db()
        self.assertEqual(res.provider, "Airbnb")
        self.assertEqual(res.property_name, "Lakeside 3BR")
        self.assertEqual(res.host_name, "Maria")


class ReservationHotelRentalTestCase(ReservationViewTestBase):
    def test_airbnb_style_create_and_display(self):
        payload = self.old_payload(
            "HOTEL",
            provider="Airbnb",
            confirmation_number="HMABCD1234",
            property_name="Lakeside 3BR near Disney",
            address="123 Lakeshore Dr, Kissimmee, FL",
            room_type="3BR condo",
            host_name="Maria",
            host_phone="(407) 555-0123",
            listing_url="https://www.airbnb.com/rooms/12345",
        )
        response = self.client.post(self.create_url, payload)
        self.assertRedirects(response, self.detail_url)
        res = Reservation.objects.get()
        self.assertEqual(res.type, "HOTEL")
        self.assertEqual(res.listing_url, "https://www.airbnb.com/rooms/12345")
        self.assertEqual(res.display_title, "Lakeside 3BR near Disney")

        page = self.client.get(self.detail_url)
        self.assertContains(page, "Lakeside 3BR near Disney")
        self.assertContains(page, "via Airbnb")
        self.assertContains(page, "Check-in Mar 4, 2026 3:00 PM")
        self.assertContains(page, "Check-out Mar 8, 2026 11:00 AM")
        self.assertContains(page, "Host: Maria")
        self.assertContains(page, "(407) 555-0123")
        self.assertContains(page, 'href="https://www.airbnb.com/rooms/12345"')
        self.assertContains(page, "View listing")

    def test_invalid_listing_url_rejected(self):
        response = self.client.post(self.create_url, self.old_payload("HOTEL", listing_url="not a url"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("listing_url", response.context["form"].errors)
        self.assertFalse(Reservation.objects.exists())

    def test_blank_listing_url_allowed(self):
        response = self.client.post(self.create_url, self.old_payload("HOTEL", listing_url=""))
        self.assertRedirects(response, self.detail_url)

    def test_card_falls_back_to_provider_and_hides_empty_host_fields(self):
        self.make(provider="Hilton Orlando")
        page = self.client.get(self.detail_url)
        self.assertContains(page, "Hilton Orlando")
        self.assertNotContains(page, "Host:")
        self.assertNotContains(page, "View listing")


class ReservationTypeSwitchTestCase(ReservationViewTestBase):
    def test_other_type_extras_cleared_on_save(self):
        response = self.client.post(
            self.create_url,
            self.old_payload("HOTEL", flight_number="DL 1234", pickup_location="MCO", property_name="Lakeside"),
        )
        self.assertRedirects(response, self.detail_url)
        res = Reservation.objects.get()
        self.assertEqual(res.flight_number, "")
        self.assertEqual(res.pickup_location, "")
        self.assertEqual(res.property_name, "Lakeside")

    def test_changing_type_on_edit_clears_previous_type_extras(self):
        res = self.make(property_name="Lakeside", host_name="Maria")
        self.client.post(
            reverse("vacations:reservation_update", kwargs={"pk": res.pk}),
            self.old_payload("CAR", provider="Enterprise", pickup_location="MCO"),
        )
        res.refresh_from_db()
        self.assertEqual(res.type, "CAR")
        self.assertEqual(res.pickup_location, "MCO")
        self.assertEqual(res.property_name, "")
        self.assertEqual(res.host_name, "")

    def test_invalid_extra_for_other_type_is_ignored(self):
        response = self.client.post(self.create_url, self.old_payload("CAR", listing_url="not a url"))
        self.assertRedirects(response, self.detail_url)


class ReservationEditExistingTestCase(ReservationViewTestBase):
    """Reservations saved before this change open in Edit with values intact."""

    def test_existing_hotel_opens_in_edit(self):
        res = self.make(provider="Hilton", confirmation_number="H-777", notes="Pool view")
        response = self.client.get(reverse("vacations:reservation_update", kwargs={"pk": res.pk}))
        self.assertEqual(response.status_code, 200)
        form = response.context["form"]
        self.assertEqual(form["provider"].value(), "Hilton")
        self.assertEqual(form["confirmation_number"].value(), "H-777")
        self.assertEqual(form["notes"].value(), "Pool view")
        # Forms show datetimes as naive values in the current (local) timezone.
        self.assertEqual(form["departure_time"].value(), _dt(4, 15).replace(tzinfo=None))
        self.assertEqual(form["arrival_time"].value(), _dt(8, 11).replace(tzinfo=None))
        self.assertContains(response, "Check-in")
        self.assertContains(response, "Check-out")
        self.assertContains(response, 'value="2026-03-04 15:00:00"')
        self.assertContains(response, 'value="2026-03-08 11:00:00"')

    def test_existing_car_opens_in_edit(self):
        res = self.make(type="CAR", provider="Enterprise", confirmation_number="E-1",
                        departure_time=_dt(4, 9), arrival_time=_dt(8, 17))
        response = self.client.get(reverse("vacations:reservation_update", kwargs={"pk": res.pk}))
        self.assertEqual(response.status_code, 200)
        form = response.context["form"]
        self.assertEqual(form["provider"].value(), "Enterprise")
        self.assertEqual(form["type"].value(), "CAR")
        self.assertContains(response, "Pick-up time")
        self.assertContains(response, "Drop-off time")
        self.assertContains(response, 'value="2026-03-04 09:00:00"')


class ReservationTripCardTestCase(ReservationViewTestBase):
    def test_car_card_labels_and_same_dropoff(self):
        self.make(type="CAR", provider="Enterprise", pickup_location="MCO Terminal B",
                  departure_time=_dt(4, 9), arrival_time=_dt(8, 17))
        page = self.client.get(self.detail_url)
        self.assertContains(page, "Pick-up time Mar 4, 2026 9:00 AM")
        self.assertContains(page, "Drop-off time Mar 8, 2026 5:00 PM")
        self.assertContains(page, "same as pick-up")
        self.assertNotContains(page, "Departure time")

    def test_flight_card_shows_flight_details(self):
        self.make(type="FLIGHT", provider="Delta", flight_number="DL 1234",
                  departure_airport="RDU", arrival_airport="MCO")
        page = self.client.get(self.detail_url)
        self.assertContains(page, "Departure time Mar 4, 2026")
        self.assertContains(page, "DL 1234")
        self.assertContains(page, "RDU → MCO")


class ReservationExportTestCase(ReservationViewTestBase):
    def test_export_writes_stored_type_value_and_new_columns(self):
        import csv
        import io
        import zipfile

        self.make(property_name="Lakeside")
        with zipfile.ZipFile(io.BytesIO(build_export_zip(self.account))) as zf:
            rows = list(csv.reader(io.StringIO(zf.read("reservations.csv").decode("utf-8"))))
        header, row = rows[0], rows[1]
        self.assertEqual(
            header[:8],
            ["id", "vacation_id", "type", "provider", "confirmation_number", "departure_time", "arrival_time", "notes"],
        )
        self.assertEqual(row[header.index("type")], "HOTEL")
        self.assertEqual(row[header.index("property_name")], "Lakeside")
