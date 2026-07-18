from datetime import date

from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin, SubscriptionRequiredMixin, get_scoped_object_or_404

from .forms import MaintenanceProjectForm, PropertyForm
from .models import MaintenanceProject, Property

_PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}


class PropertyListView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, ListView):
    model = Property
    template_name = "property/property_list.html"
    context_object_name = "properties"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        for prop in context["properties"]:
            prop.open_project_count = prop.maintenance_projects.filter(
                status__in=["planned", "in_progress"]
            ).count()
        return context


class PropertyDetailView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DetailView):
    model = Property
    template_name = "property/property_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = date.today()

        open_projects = sorted(
            self.object.maintenance_projects.filter(status__in=["planned", "in_progress", "on_hold"]),
            key=lambda p: (_PRIORITY_ORDER.get(p.priority, 99), p.due_date or date(9999, 12, 31)),
        )
        context["open_projects"] = open_projects
        context["completed_projects"] = self.object.maintenance_projects.filter(
            status="completed"
        ).order_by("-completion_date")
        return context


class PropertyCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountStampMixin, CreateView):
    model = Property
    form_class = PropertyForm
    template_name = "property/property_form.html"
    success_url = reverse_lazy("property:property_list")


class PropertyUpdateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, UpdateView):
    model = Property
    form_class = PropertyForm
    template_name = "property/property_form.html"

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.pk})


class PropertyDeleteView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DeleteView):
    model = Property
    template_name = "property/property_confirm_delete.html"
    success_url = reverse_lazy("property:property_list")


class MaintenanceProjectCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, CreateView):
    model = MaintenanceProject
    form_class = MaintenanceProjectForm
    template_name = "property/maintenance_form.html"

    def _get_property(self):
        return get_scoped_object_or_404(Property, self.request.account, pk=self.kwargs["property_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self._get_property()
        return context

    def form_valid(self, form):
        form.instance.prop = self._get_property()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.kwargs["property_pk"]})


class MaintenanceProjectUpdateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, UpdateView):
    model = MaintenanceProject
    form_class = MaintenanceProjectForm
    template_name = "property/maintenance_form.html"
    account_lookup = "prop__account"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self.object.prop
        return context

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk})


class MaintenanceProjectDeleteView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DeleteView):
    model = MaintenanceProject
    template_name = "property/maintenance_confirm_delete.html"
    account_lookup = "prop__account"

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk})
