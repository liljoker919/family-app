from datetime import date

from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin

from .forms import ItineraryItemForm, ReservationForm, VacationExpenseForm, VacationForm
from .models import ItineraryItem, Reservation, Vacation, VacationExpense


# ── Vacation CRUD ─────────────────────────────────────────────────────────────

class VacationListView(LoginRequiredMixin, AccountScopedMixin, ListView):
    model = Vacation
    template_name = "vacations/vacation_list.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = date.today()
        base_qs = Vacation.objects.filter(account=self.request.account)
        context["upcoming"] = base_qs.filter(end_date__gte=today).order_by("start_date")
        context["past"] = base_qs.filter(end_date__lt=today).order_by("-start_date")
        return context


class VacationDetailView(LoginRequiredMixin, AccountScopedMixin, DetailView):
    model = Vacation
    template_name = "vacations/vacation_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["reservations"] = self.object.reservations.order_by("departure_time")
        context["expenses"] = self.object.expenses.order_by("date", "category")

        items = list(self.object.itinerary.order_by("date", "time"))
        itinerary_by_date = {}
        for item in items:
            itinerary_by_date.setdefault(item.date, []).append(item)
        context["itinerary_by_date"] = itinerary_by_date
        return context


class VacationCreateView(LoginRequiredMixin, AccountStampMixin, CreateView):
    model = Vacation
    form_class = VacationForm
    template_name = "vacations/vacation_form.html"
    success_url = reverse_lazy("vacations:vacation_list")


class VacationUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = Vacation
    form_class = VacationForm
    template_name = "vacations/vacation_form.html"

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.pk})


class VacationDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = Vacation
    template_name = "vacations/vacation_confirm_delete.html"
    success_url = reverse_lazy("vacations:vacation_list")


# ── Expense CRUD ──────────────────────────────────────────────────────────────

class ExpenseCreateView(LoginRequiredMixin, CreateView):
    model = VacationExpense
    form_class = VacationExpenseForm
    template_name = "vacations/expense_form.html"

    def _get_vacation(self):
        return get_object_or_404(Vacation, pk=self.kwargs["vacation_pk"], account=self.request.account)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vacation"] = self._get_vacation()
        return context

    def form_valid(self, form):
        form.instance.vacation = self._get_vacation()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.kwargs["vacation_pk"]}) + "?tab=expenses"


class ExpenseUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = VacationExpense
    form_class = VacationExpenseForm
    template_name = "vacations/expense_form.html"
    account_lookup = "vacation__account"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vacation"] = self.object.vacation
        return context

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.vacation.pk}) + "?tab=expenses"


class ExpenseDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = VacationExpense
    template_name = "vacations/expense_confirm_delete.html"
    account_lookup = "vacation__account"

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.vacation.pk}) + "?tab=expenses"


# ── Reservation CRUD ──────────────────────────────────────────────────────────

class ReservationCreateView(LoginRequiredMixin, CreateView):
    model = Reservation
    form_class = ReservationForm
    template_name = "vacations/reservation_form.html"

    def _get_vacation(self):
        return get_object_or_404(Vacation, pk=self.kwargs["vacation_pk"], account=self.request.account)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vacation"] = self._get_vacation()
        return context

    def form_valid(self, form):
        form.instance.vacation = self._get_vacation()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.kwargs["vacation_pk"]}) + "?tab=reservations"


class ReservationUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = Reservation
    form_class = ReservationForm
    template_name = "vacations/reservation_form.html"
    account_lookup = "vacation__account"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vacation"] = self.object.vacation
        return context

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.vacation.pk}) + "?tab=reservations"


class ReservationDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = Reservation
    template_name = "vacations/reservation_confirm_delete.html"
    account_lookup = "vacation__account"

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.vacation.pk}) + "?tab=reservations"


# ── Itinerary CRUD ────────────────────────────────────────────────────────────

class ItineraryItemCreateView(LoginRequiredMixin, CreateView):
    model = ItineraryItem
    form_class = ItineraryItemForm
    template_name = "vacations/itineraryitem_form.html"

    def _get_vacation(self):
        return get_object_or_404(Vacation, pk=self.kwargs["vacation_pk"], account=self.request.account)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vacation"] = self._get_vacation()
        return context

    def form_valid(self, form):
        form.instance.vacation = self._get_vacation()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.kwargs["vacation_pk"]}) + "?tab=itinerary"


class ItineraryItemUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = ItineraryItem
    form_class = ItineraryItemForm
    template_name = "vacations/itineraryitem_form.html"
    account_lookup = "vacation__account"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vacation"] = self.object.vacation
        return context

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.vacation.pk}) + "?tab=itinerary"


class ItineraryItemDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = ItineraryItem
    template_name = "vacations/itineraryitem_confirm_delete.html"
    account_lookup = "vacation__account"

    def get_success_url(self):
        return reverse_lazy("vacations:vacation_detail", kwargs={"pk": self.object.vacation.pk}) + "?tab=itinerary"
