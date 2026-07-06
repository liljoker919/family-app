from datetime import date

from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .forms import (
    GuestBookingForm,
    GuestForm,
    MaintenanceProjectForm,
    MortgageForm,
    PropertyForm,
    PropertyTransactionForm,
)
from .models import Guest, GuestBooking, MaintenanceProject, Mortgage, Property, PropertyTransaction

_PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}

_MONTH_CHOICES = [
    (1, "January"), (2, "February"), (3, "March"), (4, "April"),
    (5, "May"), (6, "June"), (7, "July"), (8, "August"),
    (9, "September"), (10, "October"), (11, "November"), (12, "December"),
]


class PropertyListView(LoginRequiredMixin, ListView):
    model = Property
    template_name = "property/property_list.html"
    context_object_name = "properties"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        current_year = date.today().year
        for prop in context["properties"]:
            prop.ytd_totals = prop.calculate_totals(year=current_year)
            prop.open_project_count = prop.maintenance_projects.filter(
                status__in=["planned", "in_progress"]
            ).count()
        context["current_year"] = current_year
        return context


class PropertyDetailView(LoginRequiredMixin, DetailView):
    model = Property
    template_name = "property/property_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = date.today()

        try:
            selected_year = int(self.request.GET.get("year", today.year))
        except (ValueError, TypeError):
            selected_year = today.year

        month_raw = self.request.GET.get("month", "")
        try:
            selected_month = int(month_raw) if month_raw else None
        except ValueError:
            selected_month = None

        qs = self.object.transactions.order_by("-date")
        if selected_year:
            qs = qs.filter(date__year=selected_year)
        if selected_month:
            qs = qs.filter(date__month=selected_month)

        context["transactions"] = qs
        context["totals"] = self.object.calculate_totals(year=selected_year, month=selected_month)
        context["selected_year"] = selected_year
        context["selected_month"] = selected_month
        context["years"] = range(today.year - 5, today.year + 2)
        context["month_choices"] = _MONTH_CHOICES

        open_projects = sorted(
            self.object.maintenance_projects.filter(status__in=["planned", "in_progress", "on_hold"]),
            key=lambda p: (_PRIORITY_ORDER.get(p.priority, 99), p.due_date or date(9999, 12, 31)),
        )
        context["open_projects"] = open_projects
        context["completed_projects"] = self.object.maintenance_projects.filter(
            status="completed"
        ).order_by("-completion_date")
        context["bookings"] = self.object.bookings.select_related("guest").all()
        return context


class PropertyCreateView(LoginRequiredMixin, CreateView):
    model = Property
    form_class = PropertyForm
    template_name = "property/property_form.html"
    success_url = reverse_lazy("property:property_list")


class PropertyUpdateView(LoginRequiredMixin, UpdateView):
    model = Property
    form_class = PropertyForm
    template_name = "property/property_form.html"

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.pk})


class PropertyDeleteView(LoginRequiredMixin, DeleteView):
    model = Property
    template_name = "property/property_confirm_delete.html"
    success_url = reverse_lazy("property:property_list")


class TransactionCreateView(LoginRequiredMixin, CreateView):
    model = PropertyTransaction
    form_class = PropertyTransactionForm
    template_name = "property/transaction_form.html"

    def _get_property(self):
        return get_object_or_404(Property, pk=self.kwargs["property_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self._get_property()
        return context

    def form_valid(self, form):
        form.instance.prop = self._get_property()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.kwargs["property_pk"]})


class TransactionUpdateView(LoginRequiredMixin, UpdateView):
    model = PropertyTransaction
    form_class = PropertyTransactionForm
    template_name = "property/transaction_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self.object.prop
        return context

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk})


class TransactionDeleteView(LoginRequiredMixin, DeleteView):
    model = PropertyTransaction
    template_name = "property/transaction_confirm_delete.html"

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk})


# ── Mortgage CRUD ─────────────────────────────────────────────────────────────

class MortgageCreateView(LoginRequiredMixin, CreateView):
    model = Mortgage
    form_class = MortgageForm
    template_name = "property/mortgage_form.html"

    def _get_property(self):
        return get_object_or_404(Property, pk=self.kwargs["property_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self._get_property()
        return context

    def form_valid(self, form):
        form.instance.prop = self._get_property()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.kwargs["property_pk"]}) + "?tab=financials"


class MortgageUpdateView(LoginRequiredMixin, UpdateView):
    model = Mortgage
    form_class = MortgageForm
    template_name = "property/mortgage_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self.object.prop
        return context

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk}) + "?tab=financials"


# ── Maintenance CRUD ──────────────────────────────────────────────────────────

class MaintenanceProjectCreateView(LoginRequiredMixin, CreateView):
    model = MaintenanceProject
    form_class = MaintenanceProjectForm
    template_name = "property/maintenance_form.html"

    def _get_property(self):
        return get_object_or_404(Property, pk=self.kwargs["property_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self._get_property()
        return context

    def form_valid(self, form):
        form.instance.prop = self._get_property()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.kwargs["property_pk"]}) + "?tab=maintenance"


class MaintenanceProjectUpdateView(LoginRequiredMixin, UpdateView):
    model = MaintenanceProject
    form_class = MaintenanceProjectForm
    template_name = "property/maintenance_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self.object.prop
        return context

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk}) + "?tab=maintenance"


class MaintenanceProjectDeleteView(LoginRequiredMixin, DeleteView):
    model = MaintenanceProject
    template_name = "property/maintenance_confirm_delete.html"

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk}) + "?tab=maintenance"


# ── Guest CRM ─────────────────────────────────────────────────────────────────

class GuestListView(LoginRequiredMixin, ListView):
    model = Guest
    template_name = "property/guest_list.html"
    context_object_name = "guests"

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.GET.get("q", "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(email__icontains=q))
        return qs


class GuestCreateView(LoginRequiredMixin, CreateView):
    model = Guest
    form_class = GuestForm
    template_name = "property/guest_form.html"
    success_url = reverse_lazy("property:guest_list")


class GuestUpdateView(LoginRequiredMixin, UpdateView):
    model = Guest
    form_class = GuestForm
    template_name = "property/guest_form.html"
    success_url = reverse_lazy("property:guest_list")


class GuestDeleteView(LoginRequiredMixin, DeleteView):
    model = Guest
    template_name = "property/guest_confirm_delete.html"
    success_url = reverse_lazy("property:guest_list")


# ── Booking CRUD ──────────────────────────────────────────────────────────────

class BookingCreateView(LoginRequiredMixin, CreateView):
    model = GuestBooking
    form_class = GuestBookingForm
    template_name = "property/booking_form.html"

    def _get_property(self):
        return get_object_or_404(Property, pk=self.kwargs["property_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self._get_property()
        return context

    def form_valid(self, form):
        form.instance.prop = self._get_property()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.kwargs["property_pk"]}) + "?tab=bookings"


class BookingUpdateView(LoginRequiredMixin, UpdateView):
    model = GuestBooking
    form_class = GuestBookingForm
    template_name = "property/booking_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["prop"] = self.object.prop
        return context

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk}) + "?tab=bookings"


class BookingDeleteView(LoginRequiredMixin, DeleteView):
    model = GuestBooking
    template_name = "property/booking_confirm_delete.html"

    def get_success_url(self):
        return reverse_lazy("property:property_detail", kwargs={"pk": self.object.prop.pk}) + "?tab=bookings"
