from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin, SubscriptionRequiredMixin

from .forms import StudentForm
from .models import Student


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
