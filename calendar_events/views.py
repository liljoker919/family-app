from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.urls import reverse_lazy
from django.utils import timezone as tz
from django.utils.dateparse import parse_date, parse_datetime
from django.views.generic import CreateView, DeleteView, TemplateView, UpdateView

from .forms import CalendarEventForm
from .models import CalendarEvent


class CalendarView(LoginRequiredMixin, TemplateView):
    template_name = "calendar_events/calendar.html"


@login_required
def calendar_json_view(request):
    def _parse(s):
        if not s:
            return None
        dt = parse_datetime(s.replace("Z", "+00:00"))
        if dt and tz.is_naive(dt):
            dt = tz.make_aware(dt)
        return dt

    start_dt = _parse(request.GET.get("start", ""))
    end_dt = _parse(request.GET.get("end", ""))

    events = []

    # ── Manual CalendarEvents ────────────────────────────────────────────────
    manual_qs = CalendarEvent.objects.filter(event_type="manual")
    if start_dt:
        manual_qs = manual_qs.filter(start__gte=start_dt)
    if end_dt:
        manual_qs = manual_qs.filter(start__lt=end_dt)

    for evt in manual_qs:
        payload = {
            "id": f"manual-{evt.pk}",
            "title": evt.title,
            "allDay": evt.all_day,
            "color": "#3B82F6",
            "extendedProps": {
                "type": "manual",
                "notes": evt.notes,
                "pk": evt.pk,
            },
        }
        # Pass date-only strings for all-day events — FullCalendar infers allDay from the absence of a time component
        if evt.all_day:
            payload["start"] = evt.start.date().isoformat()
            if evt.end:
                payload["end"] = evt.end.date().isoformat()
        else:
            payload["start"] = evt.start.isoformat()
            if evt.end:
                payload["end"] = evt.end.isoformat()

        events.append(payload)

    # ── Vehicle Service Records (read live — no stored duplicates) ───────────
    try:
        from vehicles.models import VehicleService  # noqa: PLC0415

        svc_qs = VehicleService.objects.select_related("vehicle").order_by("date")
        if start_dt:
            svc_qs = svc_qs.filter(date__gte=start_dt.date())
        if end_dt:
            svc_qs = svc_qs.filter(date__lt=end_dt.date())

        for svc in svc_qs:
            events.append({
                "id": f"car-{svc.pk}",
                "title": f"{svc.get_service_type_display()} — {svc.vehicle}",
                "start": svc.date.isoformat(),
                "allDay": True,
                "color": "#F59E0B",
                "extendedProps": {
                    "type": "car",
                    "vehicle": str(svc.vehicle),
                    "vehiclePk": svc.vehicle.pk,
                    "serviceType": svc.get_service_type_display(),
                    "mileage": svc.mileage_at_service,
                    "provider": svc.provider or None,
                    "cost": str(svc.cost) if svc.cost else None,
                },
            })
    except Exception:
        pass

    return JsonResponse(events, safe=False)


class EventCreateView(LoginRequiredMixin, CreateView):
    model = CalendarEvent
    form_class = CalendarEventForm
    template_name = "calendar_events/event_form.html"
    success_url = reverse_lazy("calendar_events:calendar")

    def get_initial(self):
        initial = super().get_initial()
        date_str = self.request.GET.get("date", "")
        if date_str:
            d = parse_date(date_str)
            if d:
                initial["start"] = d.strftime("%Y-%m-%dT09:00")
                initial["end"] = d.strftime("%Y-%m-%dT10:00")
        return initial


class EventUpdateView(LoginRequiredMixin, UpdateView):
    model = CalendarEvent
    form_class = CalendarEventForm
    template_name = "calendar_events/event_form.html"
    success_url = reverse_lazy("calendar_events:calendar")


class EventDeleteView(LoginRequiredMixin, DeleteView):
    model = CalendarEvent
    template_name = "calendar_events/event_confirm_delete.html"
    success_url = reverse_lazy("calendar_events:calendar")
