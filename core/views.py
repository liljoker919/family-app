from datetime import date, datetime, timedelta

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
            from django.utils import timezone as tz  # noqa: PLC0415
            from calendar_events.views import collect_events  # noqa: PLC0415
            start_dt = tz.make_aware(datetime.combine(date.today(), datetime.min.time()))
            end_dt = start_dt + timedelta(days=7)
            summary["upcoming_event_count"] = len(collect_events(start_dt, end_dt))
        except Exception:
            pass

        return summary
