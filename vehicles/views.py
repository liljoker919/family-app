from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .forms import VehicleForm, VehicleServiceForm
from .models import Vehicle, VehicleService


class VehicleListView(LoginRequiredMixin, ListView):
    model = Vehicle
    template_name = "vehicles/vehicle_list.html"
    context_object_name = "vehicles"


class VehicleDetailView(LoginRequiredMixin, DetailView):
    model = Vehicle
    template_name = "vehicles/vehicle_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        services = list(self.object.services.order_by("date", "mileage_at_service"))
        for i, svc in enumerate(services):
            svc.mileage_delta = (
                svc.mileage_at_service - services[i - 1].mileage_at_service if i > 0 else None
            )
        context["services"] = list(reversed(services))
        return context


class VehicleCreateView(LoginRequiredMixin, CreateView):
    model = Vehicle
    form_class = VehicleForm
    template_name = "vehicles/vehicle_form.html"
    success_url = reverse_lazy("vehicles:vehicle_list")


class VehicleUpdateView(LoginRequiredMixin, UpdateView):
    model = Vehicle
    form_class = VehicleForm
    template_name = "vehicles/vehicle_form.html"

    def get_success_url(self):
        return reverse_lazy("vehicles:vehicle_detail", kwargs={"pk": self.object.pk})


class VehicleDeleteView(LoginRequiredMixin, DeleteView):
    model = Vehicle
    template_name = "vehicles/vehicle_confirm_delete.html"
    success_url = reverse_lazy("vehicles:vehicle_list")


class ServiceCreateView(LoginRequiredMixin, CreateView):
    model = VehicleService
    form_class = VehicleServiceForm
    template_name = "vehicles/service_form.html"

    def _get_vehicle(self):
        return get_object_or_404(Vehicle, pk=self.kwargs["vehicle_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vehicle"] = self._get_vehicle()
        return context

    def form_valid(self, form):
        form.instance.vehicle = self._get_vehicle()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("vehicles:vehicle_detail", kwargs={"pk": self.kwargs["vehicle_pk"]})


class ServiceUpdateView(LoginRequiredMixin, UpdateView):
    model = VehicleService
    form_class = VehicleServiceForm
    template_name = "vehicles/service_form.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["vehicle"] = self.object.vehicle
        return context

    def get_success_url(self):
        return reverse_lazy("vehicles:vehicle_detail", kwargs={"pk": self.object.vehicle.pk})


class ServiceDeleteView(LoginRequiredMixin, DeleteView):
    model = VehicleService
    template_name = "vehicles/vehicleservice_confirm_delete.html"

    def get_success_url(self):
        return reverse_lazy("vehicles:vehicle_detail", kwargs={"pk": self.object.vehicle.pk})
