from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from tasks.models import FamilyTask, TaskComment

User = get_user_model()


class ChangeStatusTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.account = FamilyAccount.objects.create(name="Task Family", slug="task-family-1", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="testuser", password="testpass")
        self.task = FamilyTask.objects.create(
            account=self.account, title="Test Task", status="TODO", priority="medium"
        )

    def _post(self, status, htmx=False):
        headers = {"HTTP_HX_REQUEST": "true"} if htmx else {}
        return self.client.post(
            reverse("tasks:change_status", kwargs={"pk": self.task.pk}),
            {"status": status},
            **headers,
        )

    def test_valid_status_update_persists(self):
        self._post("IN_PROGRESS")
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "IN_PROGRESS")

    def test_todo_to_completed_in_one_step(self):
        self._post("COMPLETED")
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "COMPLETED")

    def test_invalid_status_is_ignored(self):
        self._post("INVALID")
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "TODO")

    def test_empty_status_is_ignored(self):
        self._post("")
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "TODO")

    def test_htmx_request_returns_200_with_board_template(self):
        response = self._post("IN_PROGRESS", htmx=True)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "tasks/_board.html")

    def test_regular_post_redirects_to_board(self):
        response = self._post("IN_PROGRESS")
        self.assertRedirects(response, reverse("tasks:board"))

    def test_unauthenticated_redirects_to_login(self):
        self.client.logout()
        response = self._post("IN_PROGRESS")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])


class AddCommentTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.account = FamilyAccount.objects.create(name="Task Family", slug="task-family-2", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="testuser", password="testpass")
        self.task = FamilyTask.objects.create(
            account=self.account, title="Test Task", status="TODO", priority="medium"
        )

    def test_creates_comment_linked_to_task(self):
        self.client.post(
            reverse("tasks:add_comment", kwargs={"pk": self.task.pk}),
            {"body": "Great work!"},
        )
        comment = TaskComment.objects.get(task=self.task)
        self.assertEqual(comment.body, "Great work!")

    def test_comment_author_is_logged_in_user(self):
        self.client.post(
            reverse("tasks:add_comment", kwargs={"pk": self.task.pk}),
            {"body": "Nice job"},
        )
        comment = TaskComment.objects.get(task=self.task)
        self.assertEqual(comment.author, self.user)

    def test_redirects_to_task_detail(self):
        response = self.client.post(
            reverse("tasks:add_comment", kwargs={"pk": self.task.pk}),
            {"body": "Test"},
        )
        self.assertRedirects(
            response,
            reverse("tasks:task_detail", kwargs={"pk": self.task.pk}),
        )

    def test_unauthenticated_redirects_to_login(self):
        self.client.logout()
        response = self.client.post(
            reverse("tasks:add_comment", kwargs={"pk": self.task.pk}),
            {"body": "Test"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])


class TaskBoardViewTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="boarduser", password="pass")
        self.account = FamilyAccount.objects.create(name="Board Family", slug="board-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="boarduser", password="pass")
        FamilyTask.objects.create(account=self.account, title="Buy groceries", status="TODO", priority="medium")
        FamilyTask.objects.create(account=self.account, title="Fix leak", status="IN_PROGRESS", priority="high")
        FamilyTask.objects.create(account=self.account, title="Paint fence", status="COMPLETED", priority="low")

    def test_board_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("tasks:board"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_board_returns_200_with_full_template(self):
        response = self.client.get(reverse("tasks:board"))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "tasks/task_board.html")

    def test_board_context_contains_three_column_keys(self):
        response = self.client.get(reverse("tasks:board"))
        for key in ("todo_tasks", "in_progress_tasks", "completed_tasks"):
            self.assertIn(key, response.context)

    def test_tasks_routed_into_correct_status_columns(self):
        response = self.client.get(reverse("tasks:board"))
        self.assertEqual(len(response.context["todo_tasks"]), 1)
        self.assertEqual(response.context["todo_tasks"][0].title, "Buy groceries")
        self.assertEqual(len(response.context["in_progress_tasks"]), 1)
        self.assertEqual(response.context["in_progress_tasks"][0].title, "Fix leak")
        self.assertEqual(len(response.context["completed_tasks"]), 1)
