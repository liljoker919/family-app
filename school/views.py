from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin, SubscriptionRequiredMixin, get_scoped_object_or_404

from .forms import CourseForm, StudentForm
from .models import Course, Student


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
