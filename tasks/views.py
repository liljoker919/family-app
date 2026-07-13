from datetime import date

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin

from .forms import FamilyTaskForm, TaskCommentForm
from .models import FamilyTask, TaskComment, _PRIORITY_ORDER


def _board_context(account):
    base_qs = FamilyTask.objects.filter(account=account).select_related("assigned_to").prefetch_related("comments")
    today = date.today()

    def _sort_key(t):
        return (_PRIORITY_ORDER.get(t.priority, 99), t.due_date or date.max)

    return {
        "todo_tasks": sorted(base_qs.filter(status="TODO"), key=_sort_key),
        "in_progress_tasks": sorted(base_qs.filter(status="IN_PROGRESS"), key=_sort_key),
        "completed_tasks": list(base_qs.filter(status="COMPLETED").order_by("-pk")),
        "today": today,
    }


class TaskBoardView(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, "tasks/task_board.html", _board_context(request.account))


class TaskDetailView(LoginRequiredMixin, AccountScopedMixin, DetailView):
    model = FamilyTask
    template_name = "tasks/task_detail.html"
    context_object_name = "task"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["comment_form"] = TaskCommentForm()
        context["today"] = date.today()
        return context


class TaskCreateView(LoginRequiredMixin, AccountStampMixin, CreateView):
    model = FamilyTask
    form_class = FamilyTaskForm
    template_name = "tasks/task_form.html"
    success_url = reverse_lazy("tasks:board")


class TaskUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = FamilyTask
    form_class = FamilyTaskForm
    template_name = "tasks/task_form.html"
    success_url = reverse_lazy("tasks:board")


class TaskDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = FamilyTask
    template_name = "tasks/task_confirm_delete.html"
    success_url = reverse_lazy("tasks:board")


@login_required
def change_status(request, pk):
    task = get_object_or_404(FamilyTask, pk=pk, account=request.account)
    if request.method == "POST":
        new_status = request.POST.get("status")
        valid = {s for s, _ in FamilyTask.STATUS_CHOICES}
        if new_status in valid:
            task.status = new_status
            task.save(update_fields=["status"])

    is_htmx = request.headers.get("HX-Request") == "true"
    if is_htmx:
        return render(request, "tasks/_board.html", _board_context(request.account))
    return redirect("tasks:board")


@login_required
def add_comment(request, pk):
    task = get_object_or_404(FamilyTask, pk=pk, account=request.account)
    if request.method == "POST":
        form = TaskCommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.task = task
            comment.author = request.user
            comment.save()
    return redirect("tasks:task_detail", pk=pk)
