# Student Coursework Tracker

Extends Hey Famly with a "School" module: per-kid courses and assignments that
show up alongside existing family events and tasks, rather than as a
disconnected app. Originally scoped in a Claude Desktop planning session; this
doc adapts that plan to the app's actual data model and conventions.

---

## Decisions (resolved against the existing codebase)

The original planning notes assumed a few things the codebase doesn't
actually have. These were resolved before any code was written:

1. **There is no kid/child model today.** Only adults have logins —
   `FamilyMembership` links Django `User` → `FamilyAccount`, roles are just
   `owner`/`member` (`core/models.py`). Kids are not represented anywhere.
   → **Add a new `Student` model**, FK'd directly to `FamilyAccount` (same
   shape as `Vehicle`), with no auth of its own. Parents manage everything.
   Kid login is explicitly out of scope here — a candidate future milestone,
   not a blocker for this one.

2. **Assignments get their own model, not a `course_id` bolted onto
   `FamilyTask`.** `FamilyTask` (`tasks/models.py`) has no category/tag field
   today and its `assigned_to` points at `User` — adults only. Assignments
   need `course`, `type`, `estimated_minutes`, computed `priority`, none of
   which belong on the general-purpose task board. A separate `Assignment`
   model, shaped like the `Vehicle`/`VehicleService` parent-child pattern,
   keeps Tasks untouched. An assignment may optionally cross-link to a
   `FamilyTask` (`linked_task_id`) for a family that wants it on the Kanban
   board too, but it isn't required to live there.

3. **"School" is a new top-level sidebar item**, its own Django app
   (`school`), following the same pattern as `vehicles`/`cookbook`/`shopping`
   — not nested under Tasks. The sidebar in `templates/base.html` is a flat
   hardcoded list keyed by `request.resolver_match.app_name`; a new entry
   slots in the same way the existing ones do.

---

## Data model

New app: `school`. All models get `account` as a **required** FK from the
start (not nullable) — per the convention set in
`calendar_events/models.py`'s `ExternalCalendarFeed` docstring: new models
with no legacy single-tenant data to backfill skip the nullable-FK/backfill
dance older models needed (see `SAAS_TRANSITION.md` Phase 1.2).

```python
# school/models.py
from django.db import models
from simple_history.models import HistoricalRecords


class Student(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount", on_delete=models.CASCADE, related_name="students"
    )
    name = models.CharField(max_length=100)
    school_name = models.CharField(max_length=150, blank=True)
    grade_level = models.CharField(max_length=30, blank=True)  # free text: "10th", "Freshman"

    history = HistoricalRecords()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Course(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount", on_delete=models.CASCADE, related_name="courses"
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="courses")
    name = models.CharField(max_length=150)  # "AP Chemistry"
    color = models.CharField(max_length=7, default="#8B5CF6")  # hex, matches calendar color convention
    instructor = models.CharField(max_length=100, blank=True)
    room = models.CharField(max_length=50, blank=True)

    MEETING_DAY_CHOICES = [
        ("mon", "Monday"), ("tue", "Tuesday"), ("wed", "Wednesday"),
        ("thu", "Thursday"), ("fri", "Friday"), ("sat", "Saturday"), ("sun", "Sunday"),
    ]
    meeting_days = models.JSONField(default=list, blank=True)  # ["mon", "wed", "fri"]
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    term = models.CharField(max_length=50, blank=True)  # "Fall 2026"

    history = HistoricalRecords()

    class Meta:
        ordering = ["student__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.student})"


class Assignment(models.Model):
    TYPE_CHOICES = [
        ("homework", "Homework"), ("quiz", "Quiz"), ("exam", "Exam"),
        ("project", "Project"), ("reading", "Reading"),
    ]
    STATUS_CHOICES = [
        ("not_started", "Not Started"), ("in_progress", "In Progress"), ("done", "Done"),
    ]

    account = models.ForeignKey(
        "core.FamilyAccount", on_delete=models.CASCADE, related_name="assignments"
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assignments")
    # Denormalized for calendar/dashboard queries that filter by kid without a course join.
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="assignments")

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="homework")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="not_started")
    due_date = models.DateField()
    due_time = models.TimeField(null=True, blank=True)
    estimated_minutes = models.PositiveIntegerField(null=True, blank=True)

    # Optional cross-links — nullable, a family isn't required to use either.
    linked_task = models.ForeignKey(
        "tasks.FamilyTask", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    linked_event = models.ForeignKey(
        "calendar_events.CalendarEvent", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["due_date", "due_time"]

    def __str__(self):
        return f"{self.title} — {self.course}"

    @property
    def priority_score(self):
        """Lower is more urgent. Combines due-date proximity, type weight,
        and estimated effort so the dashboard widget can sort by something
        smarter than raw due_date."""
        from datetime import date
        days_out = (self.due_date - date.today()).days
        type_weight = {"exam": -2, "project": -1, "quiz": 0, "homework": 1, "reading": 1}.get(self.type, 0)
        effort_weight = (self.estimated_minutes or 30) / 60
        return days_out + type_weight + effort_weight


class Subtask(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]
```

`Reminder` and `GradeItem` are deferred to Phase 2/3 (below) — no schema
committed yet since they depend on decisions not yet made (what notification
infra to build; whether grade tracking is even wanted after Phase 1 is in
use).

### Views / URLs

Mirrors `vehicles/views.py` and `vehicles/urls.py` exactly:

- `Student{List,Detail,Create,Update,Delete}View` — `LoginRequiredMixin, SubscriptionRequiredMixin, AccountScopedMixin` (or `AccountStampMixin` for Create).
- `Course{List,Detail,Create,Update,Delete}View` — same stack; `CourseCreateView` resolves the parent `Student` via `get_scoped_object_or_404(Student, self.request.account, pk=self.kwargs["student_pk"])`, same as `ServiceCreateView._get_vehicle()`.
- `Assignment{List,Detail,Create,Update,Delete}View` — same pattern, nested under a course; `account_lookup = "course__account"` on scoped views reached through the parent, matching `ServiceUpdateView.account_lookup = "vehicle__account"`.
- URLs mounted at `/school/`, namespace `school`: `students/`, `students/add/`, `students/<pk>/`, `students/<student_pk>/courses/add/`, `courses/<pk>/`, `courses/<course_pk>/assignments/add/`, `assignments/<pk>/edit/`, etc.

---

## Integration points

### 1. Calendar (`calendar_events`)

`collect_events()` in `calendar_events/views.py` already aggregates five
independent sources into one JSON feed each page load (`CalendarEvent`,
`VehicleService`, `Vacation`, `MaintenanceProject`, `FamilyTask`) — each in
its own try/except so one source failing doesn't break the calendar. Add a
sixth and seventh block the same way:

- **Course meeting blocks**: for each `Course` with `meeting_days` set,
  expand into recurring blocks within the requested date range (no `RRULE`
  support exists anywhere in this codebase yet — expand in Python at query
  time, same as the rest of `collect_events()` does no real recurrence
  either). Color = `course.color`. Type = `"course"`.
- **Assignment due dates**: one entry per `Assignment` with `due_date` in
  range. Color = `course.color` (or a fixed "School" amber/purple, consistent
  with how `event_type` colors are chosen today). Type = `"assignment"`.

Add matching entries to the static legend and the `showEventModal()`
if/else-if chain in `templates/calendar_events/calendar.html`, following the
existing per-type badge/field pattern (`'manual'`, `'car'`, `'vacation'`, …).

### 2. Tasks

No schema change to `FamilyTask`. `Assignment.linked_task` is optional — if a
family wants an assignment to also appear on the Kanban board, they (or a
"Send to Tasks" button on the assignment detail page) create a `FamilyTask`
and set the link. Not automatic, not required.

### 3. Dashboard

Add a "Due soon" card per student, same visual language as existing dashboard
summary cards, sorted by `Assignment.priority_score` rather than raw
`due_date`.

### 4. Sidebar

New `<a>` block in `templates/base.html`'s nav list, `{% if app_name ==
'school' %}` for active-state, following the existing copy-pasted-entry
pattern (see Vehicles entry, `templates/base.html:61-73`).

---

## Build phases

**Phase 1** (this milestone)
- `Student` model + list/setup screen (mirrors Vehicle list/form)
- `Course` model + CRUD, nested under a student
- `Assignment` model + CRUD, nested under a course, with `priority_score`
- Calendar integration: course meeting blocks + assignment due dates as a
  "School" category
- Sidebar nav entry
- Dashboard "Due soon" widget

**Phase 2**
- `Reminder` model + delivery. No scheduled/background job infrastructure
  exists yet (no Celery, no cron-triggered management commands for in-app
  reminders) — this phase has to build that, not just reuse something.
  Delivery itself can reuse the `send_mail()` + SES best-effort pattern from
  `core/email_verification.py`.
- Recurring class-time blocks done properly if Python-side expansion in
  Phase 1 proves too limited.

**Phase 3**
- Syllabus import (photo/PDF → OCR → auto-create course + assignments)
- `GradeItem` model + grade tracker per course

**Phase 4** — superseded by "Kid Login & Self-Service Agenda" below (pulled
forward on 2026-09-16; Phase 1 alone left every assignment parent-entered,
which doesn't match the actual requirement).
- Per-student "school dashboard" view

---

## Kid Login & Self-Service Agenda (elevated from Phase 4, 2026-09-16)

Phase 1 shipped with kids as data-only `Student` records — no login, parent
enters everything. That doesn't match the real requirement: **a kid needs to
open the app themselves, see their week, add their own assignments/tests,
and check things off as they finish them.** This section replaces the old
"Phase 4: kid login" bullet with an actual design, tracked as its own
milestone (separate from Phase 1's, since it touches core auth/tenancy, not
just the `school` app).

### Decision: real login, restricted role, read-only calendar

Two shapes were considered: a full account with its own username/password
vs. a lightweight shared-device PIN unlocking a kid-mode view inside a
parent's session. **Real login was chosen** — a kid needs to reach their
agenda independently, from their own device/browser, not only on a shared
family device someone else already unlocked. Calendar access (read-only) is
included so a kid can see family context (vacations, other events) around
their own due dates, not just an isolated assignment list.

### Data model changes

```python
# core/models.py
class FamilyMembership(models.Model):
    ROLE_CHOICES = [("owner", "Owner"), ("member", "Member"), ("student", "Student")]
    ...

# school/models.py
class Student(models.Model):
    ...
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="student_profile",
    )
```

A kid's `User` gets a `FamilyMembership` row with `role="student"` — this is
enough for `TenantMiddleware` to resolve `request.account` with **no changes
to that middleware at all** (it only ever looked up *a* membership, never
checked role). All the new work is in restricting what a `student`-role user
can reach and see once `request.account` is set.

### Access control

Two new pieces in `core/mixins.py`, both keyed off the logged-in user's
`FamilyMembership.role`:

1. **A path allowlist** (middleware, alongside `TenantMiddleware` and
   `EmailVerificationMiddleware`) — a `student`-role user can only reach
   their own agenda, the school assignment views, the calendar (GET only),
   and logout. Every other path (`/vehicles/`, `/property/`, `/tasks/`,
   `/shopping/`, `/cookbook/`, `/vacations/`, `/profile/`, `/invite/`,
   `/admin/`, other students' school pages) redirects to their agenda.
2. **A queryset-scoping mixin** for the `Student`/`Course`/`Assignment`
   views themselves — a `student`-role user's queries are further filtered
   down to *their own* `Student` record (via `request.user.student_profile`)
   on top of the existing `AccountScopedMixin` account filter, so a kid can
   never see a sibling's courses or grades. `Student`/`Course`
   create/update/delete stay parent-only even for the owning kid's own
   record — a kid manages assignments, not their own enrollment.

Calendar: `EventCreateView`/`EventUpdateView`/`EventDeleteView` reject
`student`-role users server-side, not just hide the buttons in the template.
Worth revisiting whether `VehicleService.cost` should be redacted from the
event feed for this role — it's financial detail exposed today via the
existing "Vehicle Maintenance" event modal, deliberately not addressed here.

### Parent-facing "Give access" flow

A kid doesn't have their own email the way an invited adult does, so this
can't reuse `django-invitations` as-is. A button on the student detail page
(owner/member only) lets the parent set a username + password directly for
that `Student`, creating the `User` + `FamilyMembership(role="student")` in
one step and linking `Student.user`. Must **not** create an
`EmailVerification` row — mirror how invited members already skip that path
(#377) so `EmailVerificationMiddleware` never blocks a kid's login. A
"Revoke access" action removes the login without deleting the `Student`
record or their assignment history.

### Kid-facing UI

- **Login redirect**: `LOGIN_REDIRECT_URL` is currently a fixed
  `/dashboard/` for everyone — a `student`-role user needs to land on their
  agenda instead, not the parent dashboard.
- **Minimal sidebar**: `templates/base.html`'s nav shows only "My Agenda"
  and "Calendar" (+ logout) for a `student`-role user, same
  `{% if %}`-per-entry pattern already in use, just gated on role instead of
  `app_name`.
- **"My Agenda"**: new view — this week's assignments across the kid's own
  courses, sorted by `priority_score`, with an inline status checkbox
  (`not_started` → `in_progress` → `done`, likely htmx like
  `tasks:change_status` already does) and a quick "add assignment" form
  whose course dropdown is limited to the kid's own courses.

---

## Migrations

Standard Django migrations, one `school/migrations/` folder, `account`
required from row one (see `calendar_events/migrations/0003_externalcalendarfeed.py`
for the pattern — cross-app `dependencies` entry on `core`'s latest
migration, no nullable-FK/backfill dance needed since there's no legacy data).

---

*Last updated: 2026-09-16*
