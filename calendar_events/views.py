import logging
from datetime import date as dt_date, datetime, timedelta, timezone as dt_timezone

import requests
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.urls import reverse_lazy
from django.utils import timezone as tz
from django.utils.dateparse import parse_date, parse_datetime
from django.views.generic import CreateView, DeleteView, TemplateView, UpdateView

from .forms import CalendarEventForm
from .models import CalendarEvent

logger = logging.getLogger(__name__)


# ── External calendar source helpers ─────────────────────────────────────────

def _fetch_google_events(start_dt, end_dt):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds_path = getattr(settings, "GOOGLE_CALENDAR_CREDENTIALS", None)
    calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "primary")
    if not creds_path:
        return []

    credentials = service_account.Credentials.from_service_account_file(
        creds_path,
        scopes=["https://www.googleapis.com/auth/calendar.readonly"],
    )
    service = build("calendar", "v3", credentials=credentials, cache_discovery=False)

    params = {"calendarId": calendar_id, "singleEvents": True, "orderBy": "startTime"}
    if start_dt:
        params["timeMin"] = start_dt.isoformat()
    if end_dt:
        params["timeMax"] = end_dt.isoformat()

    items = service.events().list(**params).execute().get("items", [])
    events = []
    for item in items:
        start_raw = item["start"].get("dateTime") or item["start"].get("date")
        end_raw = item["end"].get("dateTime") or item["end"].get("date") if "end" in item else None
        all_day = "dateTime" not in item["start"]

        payload = {
            "id": f"google-{item['id']}",
            "title": item.get("summary") or "(No title)",
            "start": start_raw,
            "allDay": all_day,
            "color": "#10B981",
            "extendedProps": {
                "type": "google",
                "description": item.get("description", ""),
                "location": item.get("location", ""),
                "htmlLink": item.get("htmlLink", ""),
            },
        }
        if end_raw:
            payload["end"] = end_raw
        events.append(payload)

    return events


def _fetch_outlook_events(start_dt, end_dt):
    from icalendar import Calendar as ICalendar

    ical_url = getattr(settings, "OUTLOOK_ICAL_URL", None)
    if not ical_url:
        return []

    resp = requests.get(ical_url, timeout=10)
    resp.raise_for_status()

    cal = ICalendar.from_ical(resp.content)
    events = []

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
            "id": f"outlook-{component.get('UID', '')}",
            "title": str(component.get("SUMMARY", "(No title)")),
            "start": start_str,
            "allDay": all_day,
            "color": "#8B5CF6",
            "extendedProps": {
                "type": "outlook",
                "description": str(component.get("DESCRIPTION") or ""),
                "location": str(component.get("LOCATION") or ""),
            },
        }
        if end_str:
            payload["end"] = end_str
        events.append(payload)

    return events


# ── Views ─────────────────────────────────────────────────────────────────────

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
        logger.exception("Vehicle service calendar fetch failed")

    # ── Vacation windows ─────────────────────────────────────────────────────
    try:
        from vacations.models import Vacation  # noqa: PLC0415
        from django.urls import reverse  # noqa: PLC0415

        vac_qs = Vacation.objects.all()
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

        maint_qs = MaintenanceProject.objects.select_related("prop").exclude(
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

        task_qs = FamilyTask.objects.exclude(
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

    # ── Google Calendar (live proxy) ─────────────────────────────────────────
    try:
        events.extend(_fetch_google_events(start_dt, end_dt))
    except Exception:
        logger.exception("Google Calendar fetch failed")

    # ── Outlook iCal (live proxy) ────────────────────────────────────────────
    try:
        events.extend(_fetch_outlook_events(start_dt, end_dt))
    except Exception:
        logger.exception("Outlook iCal fetch failed")

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
