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
        self.client.post(
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
        self.assertNotContains(response, "Vehicles")
        self.assertNotContains(response, "Tasks")
        self.assertNotContains(response, "Shopping")
        self.assertNotContains(response, "Profile")

    def test_parent_sees_full_nav(self):
        self.client.login(username="parent406", password="pass12345")
        response = self.client.get(reverse("core:dashboard"))
        self.assertContains(response, "Vehicles")
        self.assertContains(response, "Tasks")
        self.assertContains(response, "Profile")


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


class MyAgendaViewTestCase(TestCase):
    """#409 — the kid-facing weekly self-service view: this week's
    assignments across the kid's own courses, sorted by priority_score, plus
    a quick-add form whose course dropdown is limited to their own courses."""

    def setUp(self):
        self.parent = User.objects.create_user(username="parent409", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family 409", slug="family-409", owner=self.parent, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.parent, role="owner")

        self.kid_user = User.objects.create_user(username="kid409", password="pass12345")
        self.student = Student.objects.create(account=self.account, name="Priya", user=self.kid_user)
        FamilyMembership.objects.create(account=self.account, user=self.kid_user, role="student")
        self.course = Course.objects.create(account=self.account, student=self.student, name="Algebra II")

        self.sibling = Student.objects.create(account=self.account, name="Amir")
        self.sibling_course = Course.objects.create(account=self.account, student=self.sibling, name="Biology")

        self.client.login(username="kid409", password="pass12345")

    def test_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("school:my_agenda"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_shows_own_assignment_due_this_week(self):
        Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Problem Set 1", due_date=date.today(),
        )
        response = self.client.get(reverse("school:my_agenda"))
        self.assertContains(response, "Problem Set 1")

    def test_does_not_show_assignment_outside_this_week(self):
        Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Far Future Homework", due_date=date.today() + timedelta(days=30),
        )
        response = self.client.get(reverse("school:my_agenda"))
        self.assertNotContains(response, "Far Future Homework")

    def test_does_not_show_siblings_assignment(self):
        Assignment.objects.create(
            account=self.account, course=self.sibling_course, student=self.sibling,
            title="Sibling's Lab Report", due_date=date.today(),
        )
        response = self.client.get(reverse("school:my_agenda"))
        self.assertNotContains(response, "Sibling's Lab Report")

    def test_course_dropdown_limited_to_own_courses(self):
        response = self.client.get(reverse("school:my_agenda"))
        self.assertContains(response, "Algebra II")
        self.assertNotContains(response, "Biology")

    def test_quick_add_creates_assignment_for_own_course(self):
        response = self.client.post(reverse("school:my_agenda"), {
            "course": self.course.pk, "title": "New Reading", "due_date": date.today().isoformat(),
        })
        self.assertRedirects(response, reverse("school:my_agenda"))
        assignment = Assignment.objects.get(title="New Reading")
        self.assertEqual(assignment.student, self.student)
        self.assertEqual(assignment.account, self.account)

    def test_quick_add_rejects_siblings_course(self):
        response = self.client.post(reverse("school:my_agenda"), {
            "course": self.sibling_course.pk, "title": "Hacked", "due_date": date.today().isoformat(),
        })
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Assignment.objects.filter(title="Hacked").exists())

    def test_quick_add_requires_title(self):
        self.client.post(reverse("school:my_agenda"), {
            "course": self.course.pk, "title": "", "due_date": date.today().isoformat(),
        })
        self.assertEqual(Assignment.objects.count(), 0)


class AgendaChangeStatusTestCase(TestCase):
    def setUp(self):
        self.parent = User.objects.create_user(username="parent409b", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family 409b", slug="family-409b", owner=self.parent, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.parent, role="owner")

        self.kid_user = User.objects.create_user(username="kid409b", password="pass12345")
        self.student = Student.objects.create(account=self.account, name="Priya", user=self.kid_user)
        FamilyMembership.objects.create(account=self.account, user=self.kid_user, role="student")
        self.course = Course.objects.create(account=self.account, student=self.student, name="Algebra II")
        self.assignment = Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Problem Set 1", status="not_started", due_date=date.today(),
        )

        self.sibling = Student.objects.create(account=self.account, name="Amir")
        self.sibling_course = Course.objects.create(account=self.account, student=self.sibling, name="Biology")
        self.sibling_assignment = Assignment.objects.create(
            account=self.account, course=self.sibling_course, student=self.sibling,
            title="Lab Report", status="not_started", due_date=date.today(),
        )

        self.client.login(username="kid409b", password="pass12345")

    def test_updates_own_assignment_status(self):
        self.client.post(
            reverse("school:agenda_change_status", kwargs={"pk": self.assignment.pk}), {"status": "in_progress"},
        )
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, "in_progress")

    def test_htmx_request_returns_partial(self):
        response = self.client.post(
            reverse("school:agenda_change_status", kwargs={"pk": self.assignment.pk}),
            {"status": "done"}, HTTP_HX_REQUEST="true",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "school/_agenda_assignments.html")

    def test_invalid_status_is_ignored(self):
        self.client.post(
            reverse("school:agenda_change_status", kwargs={"pk": self.assignment.pk}), {"status": "bogus"},
        )
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, "not_started")

    def test_cannot_change_siblings_assignment_status(self):
        response = self.client.post(
            reverse("school:agenda_change_status", kwargs={"pk": self.sibling_assignment.pk}),
            {"status": "done"},
        )
        self.assertEqual(response.status_code, 404)
        self.sibling_assignment.refresh_from_db()
        self.assertEqual(self.sibling_assignment.status, "not_started")


class GiveAccessViewTestCase(TestCase):
    """#407 — parent-only "Give access" flow: sets a username + password
    directly for a Student, creating the login in one step."""

    def setUp(self):
        self.parent = User.objects.create_user(username="parent407", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family 407", slug="family-407", owner=self.parent, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.parent, role="owner")
        self.student = Student.objects.create(account=self.account, name="Maya")
        self.client.login(username="parent407", password="pass12345")

    def _give_access(self, **overrides):
        data = {"username": "maya407", "password1": "Sup3rSecret!", "password2": "Sup3rSecret!"}
        data.update(overrides)
        return self.client.post(reverse("school:give_access", kwargs={"pk": self.student.pk}), data)

    def test_creates_user_and_membership_and_links_student(self):
        response = self._give_access()
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": self.student.pk}))
        self.student.refresh_from_db()
        self.assertIsNotNone(self.student.user)
        self.assertEqual(self.student.user.username, "maya407")
        membership = FamilyMembership.objects.get(account=self.account, user=self.student.user)
        self.assertEqual(membership.role, "student")

    def test_created_login_has_no_email_verification_row(self):
        """Must not create an EmailVerification row — mirrors how invited
        members already skip that path (#377) — so
        EmailVerificationMiddleware never blocks a kid's login."""
        from core.models import EmailVerification  # noqa: PLC0415

        self._give_access()
        self.student.refresh_from_db()
        self.assertFalse(EmailVerification.objects.filter(user=self.student.user).exists())

    def test_new_login_can_authenticate(self):
        self._give_access()
        self.client.logout()
        self.assertTrue(self.client.login(username="maya407", password="Sup3rSecret!"))

    def test_rejects_mismatched_passwords(self):
        response = self._give_access(password2="Different!")
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": self.student.pk}))
        self.student.refresh_from_db()
        self.assertIsNone(self.student.user)

    def test_rejects_duplicate_username(self):
        User.objects.create_user(username="taken", password="pass12345")
        response = self._give_access(username="taken")
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": self.student.pk}))
        self.student.refresh_from_db()
        self.assertIsNone(self.student.user)

    def test_cannot_give_access_to_other_accounts_student(self):
        other_owner = User.objects.create_user(username="other407", password="pass12345")
        other_account = FamilyAccount.objects.create(
            name="Other 407", slug="other-407", owner=other_owner, tier=FamilyAccount.TIER_FAMILY,
        )
        other_student = Student.objects.create(account=other_account, name="Zoe")
        response = self.client.post(
            reverse("school:give_access", kwargs={"pk": other_student.pk}),
            {"username": "hacked", "password1": "Sup3rSecret!", "password2": "Sup3rSecret!"},
        )
        self.assertEqual(response.status_code, 404)


class RevokeAccessViewTestCase(TestCase):
    def setUp(self):
        self.parent = User.objects.create_user(username="parent407b", password="pass12345")
        self.account = FamilyAccount.objects.create(
            name="Family 407b", slug="family-407b", owner=self.parent, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.parent, role="owner")
        self.kid_user = User.objects.create_user(username="kid407b", password="pass12345")
        self.student = Student.objects.create(account=self.account, name="Maya", user=self.kid_user)
        FamilyMembership.objects.create(account=self.account, user=self.kid_user, role="student")
        self.course = Course.objects.create(account=self.account, student=self.student, name="Algebra II")
        self.assignment = Assignment.objects.create(
            account=self.account, course=self.course, student=self.student,
            title="Problem Set 1", due_date=date.today(),
        )
        self.client.login(username="parent407b", password="pass12345")

    def test_deletes_user_and_membership_without_deleting_student(self):
        response = self.client.post(reverse("school:revoke_access", kwargs={"pk": self.student.pk}))
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": self.student.pk}))
        self.assertFalse(User.objects.filter(username="kid407b").exists())
        self.student.refresh_from_db()
        self.assertIsNone(self.student.user)
        self.assertTrue(Student.objects.filter(pk=self.student.pk).exists())

    def test_keeps_assignment_history(self):
        self.client.post(reverse("school:revoke_access", kwargs={"pk": self.student.pk}))
        self.assertTrue(Assignment.objects.filter(pk=self.assignment.pk).exists())

    def test_revoked_user_can_no_longer_log_in(self):
        self.client.post(reverse("school:revoke_access", kwargs={"pk": self.student.pk}))
        self.client.logout()
        self.assertFalse(self.client.login(username="kid407b", password="pass12345"))

    def test_noop_when_student_has_no_login(self):
        no_login_student = Student.objects.create(account=self.account, name="Amir")
        response = self.client.post(reverse("school:revoke_access", kwargs={"pk": no_login_student.pk}))
        self.assertRedirects(response, reverse("school:student_detail", kwargs={"pk": no_login_student.pk}))

    def test_cannot_revoke_other_accounts_student(self):
        other_owner = User.objects.create_user(username="other407b", password="pass12345")
        other_account = FamilyAccount.objects.create(
            name="Other 407b", slug="other-407b", owner=other_owner, tier=FamilyAccount.TIER_FAMILY,
        )
        other_kid = User.objects.create_user(username="otherkid407b", password="pass12345")
        other_student = Student.objects.create(account=other_account, name="Zoe", user=other_kid)
        response = self.client.post(reverse("school:revoke_access", kwargs={"pk": other_student.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(User.objects.filter(username="otherkid407b").exists())
