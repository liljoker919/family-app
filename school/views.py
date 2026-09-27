from datetime import date, timedelta

from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.utils.timezone import localdate
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import (
    AccountScopedMixin,
    AccountStampMixin,
    StudentOwnScopedMixin,
    SubscriptionRequiredMixin,
    get_scoped_object_or_404,
)
from core.models import FamilyMembership

from .forms import AssignmentForm, CourseForm, GiveAccessForm, StudentForm
from .models import Assignment, Course, Student

User = get_user_model()


class StudentListView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, ListView):
    model = Student
    template_name = "school/student_list.html"
    context_object_name = "students"


class StudentDetailView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DetailView):
    model = Student
    template_name = "school/student_detail.html"


class StudentCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountStampMixin, CreateView):
    model = Student
    form_class = StudentForm
    template_name = "school/student_form.html"
    success_url = reverse_lazy("school:student_list")


class StudentUpdateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, UpdateView):
    model = Student
    form_class = StudentForm
    template_name = "school/student_form.html"

    def get_success_url(self):
        return reverse_lazy("school:student_detail", kwargs={"pk": self.object.pk})


class StudentDeleteView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DeleteView):
    model = Student
    template_name = "school/student_confirm_delete.html"
    success_url = reverse_lazy("school:student_list")


class GiveAccessView(LoginRequiredMixin, SubscriptionRequiredMixin, View):
    """#407 — parent-only. Sets a username + password directly for a Student
    (no email required, unlike the adult invite flow), creating the User +
    FamilyMembership(role="student") in one step and linking Student.user.
    Never creates an EmailVerification row — same as the invited-member
    path (#377) — so EmailVerificationMiddleware never blocks a kid's login."""

    def post(self, request, pk):
        student = get_scoped_object_or_404(Student, request.account, pk=pk)
        form = GiveAccessForm(request.POST)
        if not form.is_valid():
            for field_errors in form.errors.values():
                for error in field_errors:
                    messages.error(request, error)
            return redirect("school:student_detail", pk=student.pk)

        data = form.cleaned_data
        user = User.objects.create_user(username=data["username"], password=data["password1"])
        FamilyMembership.objects.create(account=request.account, user=user, role="student")
        student.user = user
        student.save(update_fields=["user"])
        messages.success(request, f"Login access granted to {student.name}.")
        return redirect("school:student_detail", pk=student.pk)


class RevokeAccessView(LoginRequiredMixin, SubscriptionRequiredMixin, View):
    """Deleting the User cascades the FamilyMembership (on_delete=CASCADE)
    and nulls Student.user (on_delete=SET_NULL) — removes the login without
    touching the Student record or their assignment history."""

    def post(self, request, pk):
        student = get_scoped_object_or_404(Student, request.account, pk=pk)
        if student.user_id:
            student.user.delete()
            messages.success(request, f"Access revoked for {student.name}.")
        return redirect("school:student_detail", pk=student.pk)


class CourseDetailView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DetailView):
    model = Course
    template_name = "school/course_detail.html"


class CourseCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, CreateView):
    model = Course
    form_class = CourseForm
    template_name = "school/course_form.html"

    def _get_student(self):
        return get_scoped_object_or_404(Student, self.request.account, pk=self.kwargs["student_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["student"] = self._get_student()
        return context

    def form_valid(self, form):
        student = self._get_student()
        form.instance.student = student
        form.instance.account = self.request.account
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("school:student_detail", kwargs={"pk": self.kwargs["student_pk"]})


class CourseUpdateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, UpdateView):
    model = Course
    form_class = CourseForm
    template_name = "school/course_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["student"] = self.object.student
        return context

    def get_success_url(self):
        return reverse_lazy("school:course_detail", kwargs={"pk": self.object.pk})


class CourseDeleteView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DeleteView):
    model = Course
    template_name = "school/course_confirm_delete.html"

    def get_success_url(self):
        return reverse_lazy("school:student_detail", kwargs={"pk": self.object.student.pk})


class AssignmentDetailView(
    LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, StudentOwnScopedMixin, DetailView
):
    model = Assignment
    template_name = "school/assignment_detail.html"


class AssignmentCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, CreateView):
    model = Assignment
    form_class = AssignmentForm
    template_name = "school/assignment_form.html"

    def _get_course(self):
        course = get_scoped_object_or_404(Course, self.request.account, pk=self.kwargs["course_pk"])
        # #410 — self-service: a student-role user may only add assignments
        # to their own courses, never a sibling's.
        if getattr(self.request, "membership_role", None) == "student":
            own_student = getattr(self.request.user, "student_profile", None)
            if own_student is None or course.student_id != own_student.id:
                raise Http404
        return course

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["course"] = self._get_course()
        return context

    def form_valid(self, form):
        course = self._get_course()
        form.instance.course = course
        form.instance.student = course.student
        form.instance.account = self.request.account
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("school:course_detail", kwargs={"pk": self.kwargs["course_pk"]})


class AssignmentUpdateView(
    LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, StudentOwnScopedMixin, UpdateView
):
    model = Assignment
    form_class = AssignmentForm
    template_name = "school/assignment_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["course"] = self.object.course
        return context

    def get_success_url(self):
        return reverse_lazy("school:assignment_detail", kwargs={"pk": self.object.pk})


class AssignmentDeleteView(
    LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, StudentOwnScopedMixin, DeleteView
):
    model = Assignment
    template_name = "school/assignment_confirm_delete.html"

    def get_success_url(self):
        # A student-role user can't reach course_detail (StudentAccessMiddleware),
        # so send them back to their own agenda instead of bouncing through
        # a redirect they'd immediately get redirected away from again.
        if getattr(self.request, "membership_role", None) == "student":
            return reverse_lazy("school:my_agenda")
        return reverse_lazy("school:course_detail", kwargs={"pk": self.object.course.pk})


# ── Kid login: "My Agenda" (#409) ────────────────────────────────────────────

def _own_student_or_404(request):
    student = getattr(request.user, "student_profile", None)
    if student is None:
        raise Http404("No linked student profile.")
    return student


def _week_assignments(student):
    """This week's assignments across the kid's own courses, sorted by
    priority_score rather than raw due_date — same rationale as the
    dashboard's per-student widget (#403)."""
    start = localdate() - timedelta(days=localdate().weekday())
    end = start + timedelta(days=6)
    assignments = list(
        Assignment.objects.filter(student=student, due_date__gte=start, due_date__lte=end).select_related("course")
    )
    assignments.sort(key=lambda a: a.priority_score)
    return assignments


class MyAgendaView(LoginRequiredMixin, SubscriptionRequiredMixin, View):
    template_name = "school/my_agenda.html"

    def get(self, request):
        student = _own_student_or_404(request)
        return render(request, self.template_name, {
            "student": student,
            "assignments": _week_assignments(student),
            "courses": student.courses.all(),
            "today": date.today(),
        })

    def post(self, request):
        """Quick-add: title + due date + a course dropdown limited to the
        kid's own courses (#409/#410) — the full AssignmentCreateView isn't
        reachable here since it lives under a course's own URL and a
        student can't browse to /school/courses/<pk>/, only reach it
        directly for a course that's already theirs."""
        student = _own_student_or_404(request)
        title = request.POST.get("title", "").strip()
        due_date = request.POST.get("due_date")
        course = get_object_or_404(Course, pk=request.POST.get("course"), student=student)
        if title and due_date:
            Assignment.objects.create(
                account=request.account, course=course, student=student, title=title, due_date=due_date,
            )
            messages.success(request, "Assignment added.")
        return redirect("school:my_agenda")


@login_required
def agenda_change_status(request, pk):
    """Inline not_started -> in_progress -> done checkbox on My Agenda,
    same htmx partial-swap pattern as tasks:change_status."""
    student = _own_student_or_404(request)
    assignment = get_object_or_404(Assignment, pk=pk, student=student)

    if request.method == "POST":
        new_status = request.POST.get("status")
        valid = {s for s, _ in Assignment.STATUS_CHOICES}
        if new_status in valid:
            assignment.status = new_status
            assignment.save(update_fields=["status"])

    if request.headers.get("HX-Request") == "true":
        return render(
            request, "school/_agenda_assignments.html",
            {"assignments": _week_assignments(student), "today": date.today()},
        )
    return redirect("school:my_agenda")
