from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from core.models import FamilyAccount, FamilyMembership

from .models import Course, Student

User = get_user_model()


class StudentTenantIsolationTestCase(TestCase):
    """Students must be scoped per-account, like every other module —
    User A must never see or edit User B's students."""

    def setUp(self):
        self.user_a = User.objects.create_user(username="student_user_a", password="pass12345")
        self.account_a = FamilyAccount.objects.create(
            name="Family A", slug="family-a", owner=self.user_a, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_a, user=self.user_a, role="owner")
        self.student_a = Student.objects.create(account=self.account_a, name="Maya")

        self.user_b = User.objects.create_user(username="student_user_b", password="pass12345")
        self.account_b = FamilyAccount.objects.create(
            name="Family B", slug="family-b", owner=self.user_b, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_b, user=self.user_b, role="owner")
        self.student_b = Student.objects.create(account=self.account_b, name="Zendaya")

        self.client.login(username="student_user_a", password="pass12345")

    def test_list_only_shows_own_account_students(self):
        response = self.client.get(reverse("school:student_list"))
        self.assertContains(response, "Maya")
        self.assertNotContains(response, "Zendaya")

    def test_cannot_view_other_accounts_student(self):
        response = self.client.get(reverse("school:student_detail", kwargs={"pk": self.student_b.pk}))
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_other_accounts_student(self):
        response = self.client.post(
            reverse("school:student_update", kwargs={"pk": self.student_b.pk}),
            {"name": "Hacked", "school_name": "", "grade_level": ""},
        )
        self.assertEqual(response.status_code, 404)
        self.student_b.refresh_from_db()
        self.assertEqual(self.student_b.name, "Zendaya")

    def test_cannot_delete_other_accounts_student(self):
        response = self.client.post(reverse("school:student_delete", kwargs={"pk": self.student_b.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Student.objects.filter(pk=self.student_b.pk).exists())


class StudentCrudTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="crud_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family C", slug="family-c", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client.login(username="crud_user", password="pass12345")

    def test_create_student_stamps_account(self):
        response = self.client.post(
            reverse("school:student_create"),
            {"name": "Charlotte", "school_name": "Oakwood Elementary", "grade_level": "3rd Grade"},
        )
        student = Student.objects.get(name="Charlotte")
        self.assertRedirects(response, reverse("school:student_list"))
        self.assertEqual(student.account, self.account)

    def test_update_student(self):
        student = Student.objects.create(account=self.account, name="Charlotte")
        response = self.client.post(
            reverse("school:student_update", kwargs={"pk": student.pk}),
            {"name": "Charlotte", "school_name": "New School", "grade_level": "4th Grade"},
        )
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": student.pk}))
        student.refresh_from_db()
        self.assertEqual(student.school_name, "New School")

    def test_delete_student(self):
        student = Student.objects.create(account=self.account, name="Charlotte")
        response = self.client.post(reverse("school:student_delete", kwargs={"pk": student.pk}))
        self.assertRedirects(response, reverse("school:student_list"))
        self.assertFalse(Student.objects.filter(pk=student.pk).exists())

    def test_anonymous_user_redirected_to_login(self):
        self.client.logout()
        response = self.client.get(reverse("school:student_list"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)


class CourseTenantIsolationTestCase(TestCase):
    """Courses reach their tenant through student__account (a parent FK,
    like VehicleService->vehicle->account) — must still isolate correctly."""

    def setUp(self):
        self.user_a = User.objects.create_user(username="course_user_a", password="pass12345")
        self.account_a = FamilyAccount.objects.create(
            name="Course Family A", slug="course-family-a", owner=self.user_a, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_a, user=self.user_a, role="owner")
        self.student_a = Student.objects.create(account=self.account_a, name="Maya")
        self.course_a = Course.objects.create(account=self.account_a, student=self.student_a, name="Algebra II")

        self.user_b = User.objects.create_user(username="course_user_b", password="pass12345")
        self.account_b = FamilyAccount.objects.create(
            name="Course Family B", slug="course-family-b", owner=self.user_b, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_b, user=self.user_b, role="owner")
        self.student_b = Student.objects.create(account=self.account_b, name="Zendaya")
        self.course_b = Course.objects.create(account=self.account_b, student=self.student_b, name="Biology")

        self.client.login(username="course_user_a", password="pass12345")

    def test_cannot_view_other_accounts_course(self):
        response = self.client.get(reverse("school:course_detail", kwargs={"pk": self.course_b.pk}))
        self.assertEqual(response.status_code, 404)

    def test_cannot_create_course_under_other_accounts_student(self):
        response = self.client.post(
            reverse("school:course_create", kwargs={"student_pk": self.student_b.pk}),
            {"name": "Hacked Course", "color": "#8B5CF6", "meeting_days": []},
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_other_accounts_course(self):
        response = self.client.post(
            reverse("school:course_update", kwargs={"pk": self.course_b.pk}),
            {"name": "Hacked", "color": "#8B5CF6", "meeting_days": []},
        )
        self.assertEqual(response.status_code, 404)
        self.course_b.refresh_from_db()
        self.assertEqual(self.course_b.name, "Biology")

    def test_cannot_delete_other_accounts_course(self):
        response = self.client.post(reverse("school:course_delete", kwargs={"pk": self.course_b.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Course.objects.filter(pk=self.course_b.pk).exists())


class CourseCrudTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="course_crud_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Course Family C", slug="course-family-c", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.student = Student.objects.create(account=self.account, name="Charlotte")
        self.client.login(username="course_crud_user", password="pass12345")

    def test_create_course_stamps_account_and_student(self):
        response = self.client.post(
            reverse("school:course_create", kwargs={"student_pk": self.student.pk}),
            {
                "name": "AP Chemistry", "color": "#8B5CF6", "instructor": "Ms. Rivera",
                "room": "204", "meeting_days": ["mon", "wed", "fri"], "term": "Fall 2026",
            },
        )
        course = Course.objects.get(name="AP Chemistry")
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": self.student.pk}))
        self.assertEqual(course.account, self.account)
        self.assertEqual(course.student, self.student)
        self.assertEqual(course.meeting_days, ["mon", "wed", "fri"])

    def test_update_course(self):
        course = Course.objects.create(account=self.account, student=self.student, name="AP Chemistry")
        response = self.client.post(
            reverse("school:course_update", kwargs={"pk": course.pk}),
            {"name": "AP Chemistry", "color": "#8B5CF6", "room": "310", "meeting_days": ["tue", "thu"]},
        )
        self.assertRedirects(response, reverse("school:course_detail", kwargs={"pk": course.pk}))
        course.refresh_from_db()
        self.assertEqual(course.room, "310")
        self.assertEqual(course.meeting_days, ["tue", "thu"])

    def test_delete_course(self):
        course = Course.objects.create(account=self.account, student=self.student, name="AP Chemistry")
        response = self.client.post(reverse("school:course_delete", kwargs={"pk": course.pk}))
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": self.student.pk}))
        self.assertFalse(Course.objects.filter(pk=course.pk).exists())
