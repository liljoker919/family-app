from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from datetime import date, timedelta

from core.models import FamilyAccount, FamilyMembership

from .models import Assignment, Course, Student

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


class AssignmentTenantIsolationTestCase(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username="assign_user_a", password="pass12345")
        self.account_a = FamilyAccount.objects.create(
            name="Assign Family A", slug="assign-family-a", owner=self.user_a, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_a, user=self.user_a, role="owner")
        self.student_a = Student.objects.create(account=self.account_a, name="Maya")
        self.course_a = Course.objects.create(account=self.account_a, student=self.student_a, name="Algebra II")
        self.assignment_a = Assignment.objects.create(
            account=self.account_a, course=self.course_a, student=self.student_a,
            title="Homework 1", due_date=date.today(),
        )

        self.user_b = User.objects.create_user(username="assign_user_b", password="pass12345")
        self.account_b = FamilyAccount.objects.create(
            name="Assign Family B", slug="assign-family-b", owner=self.user_b, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account_b, user=self.user_b, role="owner")
        self.student_b = Student.objects.create(account=self.account_b, name="Zendaya")
        self.course_b = Course.objects.create(account=self.account_b, student=self.student_b, name="Biology")
        self.assignment_b = Assignment.objects.create(
            account=self.account_b, course=self.course_b, student=self.student_b,
            title="Lab Report", due_date=date.today(),
        )

        self.client.login(username="assign_user_a", password="pass12345")

    def test_cannot_view_other_accounts_assignment(self):
        response = self.client.get(reverse("school:assignment_detail", kwargs={"pk": self.assignment_b.pk}))
        self.assertEqual(response.status_code, 404)

    def test_cannot_create_assignment_under_other_accounts_course(self):
        response = self.client.post(
            reverse("school:assignment_create", kwargs={"course_pk": self.course_b.pk}),
            {"title": "Hacked", "type": "homework", "status": "not_started", "due_date": date.today()},
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_other_accounts_assignment(self):
        response = self.client.post(
            reverse("school:assignment_update", kwargs={"pk": self.assignment_b.pk}),
            {"title": "Hacked", "type": "homework", "status": "not_started", "due_date": date.today()},
        )
        self.assertEqual(response.status_code, 404)
        self.assignment_b.refresh_from_db()
        self.assertEqual(self.assignment_b.title, "Lab Report")

    def test_cannot_delete_other_accounts_assignment(self):
        response = self.client.post(reverse("school:assignment_delete", kwargs={"pk": self.assignment_b.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Assignment.objects.filter(pk=self.assignment_b.pk).exists())


class AssignmentCrudTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="assign_crud_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Assign Family C", slug="assign-family-c", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.student = Student.objects.create(account=self.account, name="Charlotte")
        self.course = Course.objects.create(account=self.account, student=self.student, name="AP Chemistry")
        self.client.login(username="assign_crud_user", password="pass12345")

    def test_create_assignment_stamps_account_course_and_student(self):
        response = self.client.post(
            reverse("school:assignment_create", kwargs={"course_pk": self.course.pk}),
            {
                "title": "Lab Report", "type": "project", "status": "not_started",
                "due_date": date.today() + timedelta(days=3), "estimated_minutes": 90,
            },
        )
        assignment = Assignment.objects.get(title="Lab Report")
        self.assertRedirects(response, reverse("school:course_detail", kwargs={"pk": self.course.pk}))
        self.assertEqual(assignment.account, self.account)
        self.assertEqual(assignment.course, self.course)
        self.assertEqual(assignment.student, self.student)

    def test_update_assignment(self):
        assignment = Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Lab Report", due_date=date.today(),
        )
        response = self.client.post(
            reverse("school:assignment_update", kwargs={"pk": assignment.pk}),
            {"title": "Lab Report", "type": "project", "status": "done", "due_date": date.today()},
        )
        self.assertRedirects(response, reverse("school:assignment_detail", kwargs={"pk": assignment.pk}))
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "done")

    def test_delete_assignment(self):
        assignment = Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Lab Report", due_date=date.today(),
        )
        response = self.client.post(reverse("school:assignment_delete", kwargs={"pk": assignment.pk}))
        self.assertRedirects(response, reverse("school:course_detail", kwargs={"pk": self.course.pk}))
        self.assertFalse(Assignment.objects.filter(pk=assignment.pk).exists())


class AssignmentPriorityScoreTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="priority_user", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Priority Family", slug="priority-family", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        self.student = Student.objects.create(account=self.account, name="Charlotte")
        self.course = Course.objects.create(account=self.account, student=self.student, name="AP Chemistry")

    def _assignment(self, **kwargs):
        defaults = {"account": self.account, "course": self.course, "student": self.student, "title": "x"}
        defaults.update(kwargs)
        return Assignment.objects.create(**defaults)

    def test_exam_due_same_day_outranks_homework_due_same_day(self):
        exam = self._assignment(type="exam", due_date=date.today())
        homework = self._assignment(type="homework", due_date=date.today())
        self.assertLess(exam.priority_score, homework.priority_score)

    def test_sooner_due_date_outranks_later_due_date(self):
        soon = self._assignment(type="homework", due_date=date.today())
        later = self._assignment(type="homework", due_date=date.today() + timedelta(days=5))
        self.assertLess(soon.priority_score, later.priority_score)
