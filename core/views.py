from datetime import date, timedelta

from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "core/dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self._build_summary())
        return context

    def _build_summary(self):
        summary = {
            "vehicle_count": 0,
            "next_service_due": None,
            "property_count": 0,
            "property_net_ytd": None,
            "upcoming_event_count": 0,
        }

        try:
            from vehicles.models import Vehicle, VehicleService  # noqa: PLC0415
            summary["vehicle_count"] = Vehicle.objects.count()
            summary["next_service_due"] = (
                VehicleService.objects.filter(date__gte=date.today())
                .order_by("date")
                .select_related("vehicle")
                .first()
            )
        except Exception:
            pass

        try:
            from property.models import Property  # noqa: PLC0415
            props = list(Property.objects.all())
            summary["property_count"] = len(props)
            if props:
                current_year = date.today().year
                summary["property_net_ytd"] = sum(
                    p.calculate_totals(year=current_year)["net"] for p in props
                )
        except Exception:
            pass

        try:
            from calendar_events.models import CalendarEvent  # noqa: PLC0415
            today = date.today()
            summary["upcoming_event_count"] = CalendarEvent.objects.filter(
                start__date__range=(today, today + timedelta(days=7))
            ).count()
        except Exception:
            pass

        return summary
