from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from tasks.models import FamilyTask, TaskComment

User = get_user_model()


class ChangeStatusTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.client = Client()
        self.client.login(username="testuser", password="testpass")
        self.task = FamilyTask.objects.create(
            title="Test Task", status="TODO", priority="medium"
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
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.client = Client()
        self.client.login(username="testuser", password="testpass")
        self.task = FamilyTask.objects.create(
            title="Test Task", status="TODO", priority="medium"
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
