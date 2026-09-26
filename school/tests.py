from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from datetime import date, timedelta

from core.models import FamilyAccount, FamilyMembership

from .models import Assignment, Course, Student

User = get_user_model()


class StudentUserLinkTestCase(TestCase):
    """#404 — the role/model prerequisite for kid login. Migration-only:
    linking a Student to a User and giving that User a student-role
    membership shouldn't change any existing behavior."""

    def setUp(self):
        self.user = User.objects.create_user(username="parent", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family", slug="family-404", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")

    def test_student_role_is_a_valid_membership_choice(self):
        self.assertIn(("student", "Student"), FamilyMembership.ROLE_CHOICES)

    def test_student_can_be_linked_to_a_user(self):
        kid_user = User.objects.create_user(username="kid", password="pass12345")
        student = Student.objects.create(account=self.account, name="Maya", user=kid_user)
        self.assertEqual(kid_user.student_profile, student)

    def test_student_user_is_optional(self):
        student = Student.objects.create(account=self.account, name="Maya")
        self.assertIsNone(student.user)

    def test_student_role_membership_resolves_request_account(self):
        """The ticket's own claim: TenantMiddleware needs zero changes for a
        student-role membership to resolve request.account, since it never
        checked role in the first place. (StudentAccessMiddleware, added in
        #405, redirects this request elsewhere — but that's a routing
        decision on top of a correctly-resolved account, not evidence the
        account failed to resolve; see StudentAccessControlTestCase.)"""
        kid_user = User.objects.create_user(username="kid2", password="pass12345")
        Student.objects.create(account=self.account, name="Zoe", user=kid_user)
        FamilyMembership.objects.create(account=self.account, user=kid_user, role="student")
        self.client.login(username="kid2", password="pass12345")
        response = self.client.get(reverse("school:my_agenda"))
        self.assertEqual(response.status_code, 200)

    def test_deleting_linked_user_nulls_student_user_without_deleting_student(self):
        """Confirms SET_NULL — the mechanism #407's "Revoke access" relies on
        to remove a login without touching the Student record."""
        kid_user = User.objects.create_user(username="kid3", password="pass12345")
        student = Student.objects.create(account=self.account, name="Ren", user=kid_user)
        kid_user.delete()
        student.refresh_from_db()
        self.assertIsNone(student.user)
        self.assertTrue(Student.objects.filter(pk=student.pk).exists())


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


class StudentAccessControlTestCase(TestCase):
    """#405 — a student-role user is confined to their own agenda, the
    school assignment views, and the calendar; everything else redirects to
    their agenda, and a sibling's data is never reachable even via a direct
    URL to an assignment view they are otherwise allowed to use."""

    def setUp(self):
        self.parent = User.objects.create_user(username="parent405", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family 405", slug="family-405", owner=self.parent, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.parent, role="owner")

        self.kid_user = User.objects.create_user(username="kid405", password="pass12345")
        self.student = Student.objects.create(account=self.account, name="Amir", user=self.kid_user)
        FamilyMembership.objects.create(account=self.account, user=self.kid_user, role="student")
        self.course = Course.objects.create(account=self.account, student=self.student, name="Algebra II")
        self.assignment = Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Problem Set 1", due_date=date.today(),
        )

        self.sibling = Student.objects.create(account=self.account, name="Priya")
        self.sibling_course = Course.objects.create(account=self.account, student=self.sibling, name="Biology")
        self.sibling_assignment = Assignment.objects.create(
            account=self.account, course=self.sibling_course, student=self.sibling,
            title="Lab Report", due_date=date.today(),
        )

        self.client.login(username="kid405", password="pass12345")

    def test_agenda_is_reachable(self):
        response = self.client.get(reverse("school:my_agenda"))
        self.assertEqual(response.status_code, 200)

    def test_own_assignment_detail_is_reachable(self):
        response = self.client.get(reverse("school:assignment_detail", kwargs={"pk": self.assignment.pk}))
        self.assertEqual(response.status_code, 200)

    def test_calendar_get_is_reachable(self):
        response = self.client.get(reverse("calendar_events:calendar"))
        self.assertEqual(response.status_code, 200)

    def test_student_list_redirects_to_agenda(self):
        response = self.client.get(reverse("school:student_list"))
        self.assertRedirects(response, reverse("school:my_agenda"))

    def test_course_detail_redirects_to_agenda(self):
        response = self.client.get(reverse("school:course_detail", kwargs={"pk": self.course.pk}))
        self.assertRedirects(response, reverse("school:my_agenda"))

    def test_other_apps_redirect_to_agenda(self):
        for url_name in ("tasks:board", "shopping:list", "vehicles:vehicle_list", "core:profile", "core:dashboard"):
            with self.subTest(url_name=url_name):
                response = self.client.get(reverse(url_name))
                self.assertRedirects(response, reverse("school:my_agenda"))

    def test_admin_redirects_to_agenda(self):
        response = self.client.get("/admin/")
        self.assertRedirects(response, reverse("school:my_agenda"))

    def test_calendar_event_create_redirects_to_agenda(self):
        response = self.client.get(reverse("calendar_events:event_create"))
        self.assertRedirects(response, reverse("school:my_agenda"))

    def test_cannot_view_siblings_assignment(self):
        response = self.client.get(reverse("school:assignment_detail", kwargs={"pk": self.sibling_assignment.pk}))
        self.assertEqual(response.status_code, 404)

    def test_cannot_edit_siblings_assignment(self):
        response = self.client.post(
            reverse("school:assignment_update", kwargs={"pk": self.sibling_assignment.pk}),
            {"title": "Hacked", "type": "homework", "status": "not_started", "due_date": date.today()},
        )
        self.assertEqual(response.status_code, 404)
        self.sibling_assignment.refresh_from_db()
        self.assertEqual(self.sibling_assignment.title, "Lab Report")

    def test_cannot_delete_siblings_assignment(self):
        response = self.client.post(reverse("school:assignment_delete", kwargs={"pk": self.sibling_assignment.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Assignment.objects.filter(pk=self.sibling_assignment.pk).exists())

    def test_cannot_create_assignment_under_siblings_course(self):
        response = self.client.post(
            reverse("school:assignment_create", kwargs={"course_pk": self.sibling_course.pk}),
            {"title": "Hacked", "type": "homework", "status": "not_started", "due_date": date.today()},
        )
        self.assertEqual(response.status_code, 404)

    def test_can_create_assignment_under_own_course(self):
        response = self.client.post(
            reverse("school:assignment_create", kwargs={"course_pk": self.course.pk}),
            {"title": "New Homework", "type": "homework", "status": "not_started", "due_date": date.today()},
        )
        self.assertTrue(Assignment.objects.filter(title="New Homework", student=self.student).exists())

    def test_owner_role_is_unaffected(self):
        self.client.logout()
        self.client.login(username="parent405", password="pass12345")
        response = self.client.get(reverse("school:student_list"))
        self.assertEqual(response.status_code, 200)


class StudentNavTestCase(TestCase):
    """#406 — a student-role user's sidebar shows only My Agenda + Calendar
    (+ Sign out), never the full parent nav or a Profile link."""

    def setUp(self):
        self.parent = User.objects.create_user(username="parent406", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family 406", slug="family-406", owner=self.parent, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.parent, role="owner")
        self.kid_user = User.objects.create_user(username="kid406", password="pass12345")
        Student.objects.create(account=self.account, name="Sam", user=self.kid_user)
        FamilyMembership.objects.create(account=self.account, user=self.kid_user, role="student")

    def test_student_sees_minimal_nav(self):
        self.client.login(username="kid406", password="pass12345")
        response = self.client.get(reverse("school:my_agenda"))
        self.assertContains(response, "My Agenda")
        self.assertContains(response, "Calendar")
        self.assertNotContains(response, ">Dashboard<")
        self.assertNotContains(response, ">Vehicles<")
        self.assertNotContains(response, ">Tasks<")
        self.assertNotContains(response, ">Shopping<")
        self.assertNotContains(response, ">Profile<")

    def test_parent_sees_full_nav(self):
        self.client.login(username="parent406", password="pass12345")
        response = self.client.get(reverse("core:dashboard"))
        self.assertContains(response, ">Vehicles<")
        self.assertContains(response, ">Tasks<")
        self.assertContains(response, ">Profile<")


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
