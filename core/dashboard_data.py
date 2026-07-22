from datetime import date, timedelta

from django.urls import reverse
from django.utils import timezone

_PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}


def _greeting(user):
    hour = timezone.localtime().hour
    if hour < 12:
        part = "morning"
    elif hour < 18:
        part = "afternoon"
    else:
        part = "evening"
    name = user.first_name or user.username
    return f"Good {part}, {name}"


def _attention_items(account):
    """Aggregates overdue/urgent/near-term deadlines across tasks, vehicles,
    and maintenance into one list, red items before amber (#325)."""
    from property.models import MaintenanceProject  # noqa: PLC0415
    from tasks.models import FamilyTask  # noqa: PLC0415
    from vehicles.models import Vehicle  # noqa: PLC0415

    today = date.today()
    red, amber = [], []

    open_tasks = FamilyTask.objects.filter(account=account).exclude(status="COMPLETED")
    for task in open_tasks.filter(due_date__lt=today):
        red.append({
            "text": f"“{task.title}” is overdue (was due {task.due_date})",
            "url": reverse("tasks:task_detail", args=[task.pk]),
        })
    for task in open_tasks.filter(priority="urgent").exclude(due_date__lt=today):
        red.append({
            "text": f"“{task.title}” is marked urgent",
            "url": reverse("tasks:task_detail", args=[task.pk]),
        })

    for vehicle in Vehicle.objects.filter(account=account):
        if vehicle.registration_status == "expired":
            red.append({
                "text": f"{vehicle}'s registration expired {vehicle.registration_expiry}",
                "url": reverse("vehicles:vehicle_detail", args=[vehicle.pk]),
            })
        elif vehicle.registration_status == "expiring_soon":
            amber.append({
                "text": f"{vehicle}'s registration expires {vehicle.registration_expiry}",
                "url": reverse("vehicles:vehicle_detail", args=[vehicle.pk]),
            })

    soon = today + timedelta(days=7)
    projects = (
        MaintenanceProject.objects.filter(prop__account=account, due_date__gte=today, due_date__lte=soon)
        .exclude(status__in=["completed", "on_hold"])
        .select_related("prop")
    )
    for project in projects:
        amber.append({
            "text": f"{project.title} ({project.prop}) is due {project.due_date}",
            "url": reverse("property:property_detail", args=[project.prop_id]),
        })

    return [{"level": "red", **item} for item in red] + [{"level": "amber", **item} for item in amber]


def _schedule_events(account):
    """Today & Tomorrow, reusing the same collect_events() feed the full
    calendar page uses so every event source (manual, vehicle service,
    vacations, maintenance, tasks, external feeds) is represented."""
    from calendar_events.views import collect_events  # noqa: PLC0415

    today = date.today()
    start_dt = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
    end_dt = start_dt + timedelta(days=2)
    raw_events = collect_events(account, start_dt, end_dt)

    events = []
    for evt in raw_events:
        start_str = evt["start"]
        is_all_day = evt.get("allDay", False)
        if is_all_day:
            evt_date = date.fromisoformat(start_str[:10])
            time_label = "All day"
        else:
            evt_dt = timezone.datetime.fromisoformat(start_str)
            if timezone.is_aware(evt_dt):
                evt_dt = timezone.localtime(evt_dt)
            evt_date = evt_dt.date()
            # %I:%M %p isn't portable to drop its leading zero (%-I is glibc-only,
            # missing on Windows) — strip it manually instead.
            time_label = evt_dt.strftime("%I:%M %p").lstrip("0")

        if evt_date not in (today, today + timedelta(days=1)):
            continue

        events.append({
            "day": "Today" if evt_date == today else "Tomorrow",
            "date": evt_date,
            "time_label": time_label,
            "title": evt["title"],
            "color": evt.get("color", "#3B82F6"),
            "url": evt.get("url"),
        })

    events.sort(key=lambda e: (e["date"], e["time_label"]))
    return events


def _dinner_suggestion(account):
    """A random family-favorite recipe (falling back to any recipe) — not
    meal planning by date, see the #325 follow-up ticket (#370) for that."""
    from cookbook.models import Recipe  # noqa: PLC0415

    recipe = Recipe.objects.filter(account=account, is_family_favorite=True).order_by("?").first()
    if recipe is None:
        recipe = Recipe.objects.filter(account=account).order_by("?").first()
    return recipe


def _priority_tasks(account, limit=5):
    from tasks.models import FamilyTask  # noqa: PLC0415

    tasks = list(FamilyTask.objects.filter(account=account).exclude(status="COMPLETED").select_related("assigned_to"))
    tasks.sort(key=lambda t: (_PRIORITY_ORDER.get(t.priority, 99), t.due_date or date.max))
    return tasks[:limit]


def _shopping_items(account, limit=5):
    from shopping.models import ShoppingItem  # noqa: PLC0415

    return list(ShoppingItem.objects.filter(account=account).order_by("category", "name")[:limit])


def _vehicle_health(account):
    from vehicles.models import Vehicle  # noqa: PLC0415

    return list(Vehicle.objects.filter(account=account))


def _next_maintenance(account):
    from property.models import MaintenanceProject  # noqa: PLC0415

    return (
        MaintenanceProject.objects.filter(prop__account=account)
        .exclude(status__in=["completed", "on_hold"])
        .exclude(due_date__isnull=True)
        .select_related("prop")
        .order_by("due_date")
        .first()
    )


def build_dashboard_context(request):
    account = request.account
    context = {"greeting": _greeting(request.user), "today": date.today()}

    if account is None:
        return context

    context.update({
        "attention_items": _attention_items(account),
        "schedule_events": _schedule_events(account),
        "dinner_recipe": _dinner_suggestion(account),
        "priority_tasks": _priority_tasks(account),
        "shopping_items": _shopping_items(account),
        "vehicles": _vehicle_health(account),
        "property_count": account.properties.count(),
        "next_maintenance": _next_maintenance(account),
    })
    return context
