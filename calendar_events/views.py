import logging
from datetime import date as dt_date, datetime, timedelta, timezone as dt_timezone

import requests
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.utils import timezone as tz
from django.utils.dateparse import parse_date, parse_datetime
from django.views.generic import CreateView, DeleteView, TemplateView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin, SubscriptionRequiredMixin

from .forms import CalendarEventForm, ExternalCalendarFeedForm
from .models import CalendarEvent, ExternalCalendarFeed

logger = logging.getLogger(__name__)

_PROVIDER_COLORS = {
    ExternalCalendarFeed.PROVIDER_GOOGLE: "#10B981",
    ExternalCalendarFeed.PROVIDER_OUTLOOK: "#8B5CF6",
}


# ── External calendar source helper ──────────────────────────────────────────

def _fetch_ical_events(ical_url, provider, start_dt, end_dt):
    """Fetch and parse a single account's iCal feed URL (#338) — same
    mechanism for Google and Outlook, since both expose a "secret address in
    iCal format" per calendar with no OAuth required."""
    from icalendar import Calendar as ICalendar

    resp = requests.get(ical_url, timeout=10)
    resp.raise_for_status()

    cal = ICalendar.from_ical(resp.content)
    events = []
    color = _PROVIDER_COLORS.get(provider, "#8B5CF6")

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        if dtstart is None:
            continue

        start_val = dtstart.dt
        end_val = dtend.dt if dtend else None
        all_day = isinstance(start_val, dt_date) and not isinstance(start_val, datetime)

        # Filter against the requested window using UTC-normalized comparison
        if start_dt or end_dt:
            if all_day:
                cmp_dt = datetime.combine(start_val, datetime.min.time()).replace(tzinfo=dt_timezone.utc)
            elif isinstance(start_val, datetime):
                cmp_dt = start_val if start_val.tzinfo else start_val.replace(tzinfo=dt_timezone.utc)
            else:
                continue
            if start_dt and cmp_dt < start_dt:
                continue
            if end_dt and cmp_dt >= end_dt:
                continue

        start_str = start_val.isoformat()
        end_str = end_val.isoformat() if end_val is not None else None

        payload = {
            "id": f"{provider}-{component.get('UID', '')}",
            "title": str(component.get("SUMMARY", "(No title)")),
            "start": start_str,
            "allDay": all_day,
            "color": color,
            "extendedProps": {
                "type": provider,
                "description": str(component.get("DESCRIPTION") or ""),
                "location": str(component.get("LOCATION") or ""),
            },
        }
        if end_str:
            payload["end"] = end_str
        events.append(payload)

    return events


# ── Views ─────────────────────────────────────────────────────────────────────

class CalendarView(LoginRequiredMixin, SubscriptionRequiredMixin, TemplateView):
    template_name = "calendar_events/calendar.html"


def collect_events(account, start_dt, end_dt):
    if account is None:
        # account is nullable until a later migration makes it required —
        # filtering by account=None below would match legacy/orphaned rows.
        return []

    events = []

    # ── Manual CalendarEvents ────────────────────────────────────────────────
    manual_qs = CalendarEvent.objects.filter(account=account, event_type="manual")
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

        svc_qs = VehicleService.objects.filter(vehicle__account=account).select_related("vehicle").order_by("date")
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
        logger.exception("Vehicle service calendar fetch failed")

    # ── Vacation windows ─────────────────────────────────────────────────────
    try:
        from vacations.models import Vacation  # noqa: PLC0415
        from django.urls import reverse  # noqa: PLC0415

        vac_qs = Vacation.objects.filter(account=account)
        if start_dt:
            vac_qs = vac_qs.filter(end_date__gte=start_dt.date())
        if end_dt:
            vac_qs = vac_qs.filter(start_date__lt=end_dt.date())

        for vac in vac_qs:
            events.append({
                "id": f"vacation-{vac.pk}",
                "title": f"✈ {vac.name}",
                "start": vac.start_date.isoformat(),
                "end": (vac.end_date + timedelta(days=1)).isoformat(),
                "allDay": True,
                "color": "#14B8A6",
                "url": reverse("vacations:vacation_detail", args=[vac.pk]),
                "extendedProps": {
                    "type": "vacation",
                    "destination": vac.destination,
                    "status": vac.get_status_display(),
                },
            })
    except Exception:
        logger.exception("Vacation calendar fetch failed")

    # ── Maintenance deadlines ────────────────────────────────────────────────
    try:
        from property.models import MaintenanceProject  # noqa: PLC0415

        maint_qs = MaintenanceProject.objects.filter(prop__account=account).select_related("prop").exclude(
            status__in=["completed", "on_hold"]
        ).exclude(due_date__isnull=True)
        if start_dt:
            maint_qs = maint_qs.filter(due_date__gte=start_dt.date())
        if end_dt:
            maint_qs = maint_qs.filter(due_date__lt=end_dt.date())

        for project in maint_qs:
            events.append({
                "id": f"maintenance-{project.pk}",
                "title": f"🔧 {project.title} — {project.prop}",
                "start": project.due_date.isoformat(),
                "allDay": True,
                "color": "#F59E0B",
                "extendedProps": {
                    "type": "maintenance",
                    "property": str(project.prop),
                    "category": project.get_category_display(),
                    "priority": project.get_priority_display(),
                    "status": project.get_status_display(),
                },
            })
    except Exception:
        logger.exception("Maintenance calendar fetch failed")

    # ── Family Tasks with due dates ─────────────────────────────────────────
    try:
        from tasks.models import FamilyTask  # noqa: PLC0415
        from django.urls import reverse as _reverse  # noqa: PLC0415

        task_qs = FamilyTask.objects.filter(account=account).exclude(
            status="COMPLETED"
        ).exclude(due_date__isnull=True).select_related("assigned_to")
        if start_dt:
            task_qs = task_qs.filter(due_date__gte=start_dt.date())
        if end_dt:
            task_qs = task_qs.filter(due_date__lt=end_dt.date())

        for t in task_qs:
            events.append({
                "id": f"task-{t.pk}",
                "title": f"📋 {t.title}",
                "start": t.due_date.isoformat(),
                "allDay": True,
                "color": "#3B82F6",
                "url": _reverse("tasks:task_detail", args=[t.pk]),
                "extendedProps": {
                    "type": "task",
                    "status": t.get_status_display(),
                    "priority": t.get_priority_display(),
                    "assignedTo": (
                        t.assigned_to.get_full_name() or t.assigned_to.username
                        if t.assigned_to else "Unassigned"
                    ),
                },
            })
    except Exception:
        logger.exception("Family tasks calendar fetch failed")

    # ── External calendar feeds (Google/Outlook iCal, live proxy) ───────────
    for feed in ExternalCalendarFeed.objects.filter(account=account):
        try:
            events.extend(_fetch_ical_events(feed.ical_url, feed.provider, start_dt, end_dt))
        except Exception:
            logger.exception("External calendar fetch failed for feed %s", feed.pk)

    return events


@login_required
def calendar_json_view(request):
    def _parse(s):
        if not s:
            return None
        dt = parse_datetime(s.replace("Z", "+00:00"))
        if dt and tz.is_naive(dt):
            dt = tz.make_aware(dt)
        return dt

    account = request.account
    if account is None or account.tier != account.TIER_FAMILY:
        return JsonResponse({"error": "Family plan required"}, status=403)

    start_dt = _parse(request.GET.get("start", ""))
    end_dt = _parse(request.GET.get("end", ""))

    events = collect_events(account, start_dt, end_dt)
    return JsonResponse(events, safe=False)


class EventCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountStampMixin, CreateView):
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


class EventUpdateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, UpdateView):
    model = CalendarEvent
    form_class = CalendarEventForm
    template_name = "calendar_events/event_form.html"
    success_url = reverse_lazy("calendar_events:calendar")


class EventDeleteView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DeleteView):
    model = CalendarEvent
    template_name = "calendar_events/event_confirm_delete.html"
    success_url = reverse_lazy("calendar_events:calendar")


class FeedSettingsView(LoginRequiredMixin, SubscriptionRequiredMixin, TemplateView):
    """List + add page for per-account Google/Outlook iCal feed URLs (#338).
    Family-tier only, same as the calendar itself."""

    template_name = "calendar_events/feed_settings.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["feeds"] = ExternalCalendarFeed.objects.filter(account=self.request.account)
        context["form"] = ExternalCalendarFeedForm()
        return context


class FeedCreateView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountStampMixin, CreateView):
    """POST-only — the add form lives inline on the settings page itself."""

    model = ExternalCalendarFeed
    form_class = ExternalCalendarFeedForm
    http_method_names = ["post"]
    success_url = reverse_lazy("calendar_events:feed_settings")

    def form_invalid(self, form):
        # Simple redirect-with-error rather than a second template — the
        # settings page already re-renders an empty form either way.
        return redirect("calendar_events:feed_settings")


class FeedDeleteView(LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin, DeleteView):
    """POST-only — no separate confirmation page, just a delete button on
    the settings list itself."""

    model = ExternalCalendarFeed
    http_method_names = ["post"]
    success_url = reverse_lazy("calendar_events:feed_settings")

    def post(self, request, *args, **kwargs):
        return self.delete(request, *args, **kwargs)
