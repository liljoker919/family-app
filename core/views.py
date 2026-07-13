from datetime import date, datetime, timedelta

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from django_ratelimit.decorators import ratelimit


@method_decorator(ratelimit(key="ip", rate="5/m", method="POST", block=True), name="dispatch")
class RateLimitedLoginView(LoginView):
    pass


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
            "upcoming_event_count": 0,
        }

        account = self.request.account

        try:
            from vehicles.models import Vehicle, VehicleService  # noqa: PLC0415
            summary["vehicle_count"] = Vehicle.objects.filter(account=account).count()
            summary["next_service_due"] = (
                VehicleService.objects.filter(vehicle__account=account, date__gte=date.today())
                .order_by("date")
                .select_related("vehicle")
                .first()
            )
        except Exception:
            pass

        try:
            from property.models import Property  # noqa: PLC0415
            summary["property_count"] = Property.objects.filter(account=account).count()
        except Exception:
            pass

        try:
            from django.utils import timezone as tz  # noqa: PLC0415
            from calendar_events.views import collect_events  # noqa: PLC0415
            start_dt = tz.make_aware(datetime.combine(date.today(), datetime.min.time()))
            end_dt = start_dt + timedelta(days=7)
            summary["upcoming_event_count"] = len(collect_events(account, start_dt, end_dt))
        except Exception:
            pass

        return summary
