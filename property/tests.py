from datetime import date

from django.test import TestCase

from property.models import MaintenanceProject, Property


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
