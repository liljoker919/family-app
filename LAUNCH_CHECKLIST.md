# Family App – Launch Checklist

> **Purpose:** Pass/fail criteria, rollback strategy, and deployment policy for shipping family-app as a public, multi-tenant SaaS product. This replaces an earlier draft of this document that described an unrelated Amplify/DynamoDB/Cognito stack — this app is Django, deployed to a single AWS Lightsail instance via gunicorn + nginx, currently on SQLite.

This checklist tracks readiness against the SaaS launch program in GitHub milestones [#33-39](https://github.com/liljoker919/family-app/milestones?state=all): Launch Foundations → Multi-Tenancy Core → Postgres in Docker Migration → Payment Signup & Billing → Standard User Profile → Demo & Marketing Landing Page → GDPR Baseline Compliance.

---

## Table of Contents

1. [Pass / Fail Criteria](#1-pass--fail-criteria)
2. [Rollback Plan](#2-rollback-plan)
3. [Pre-Launch Dry-Run](#3-pre-launch-dry-run)
4. [Deployment Policy](#4-deployment-policy)

---

## 1. Pass / Fail Criteria

A release is **approved** only when every applicable item below is checked off. Sections 1.3 and 1.4 only become "applicable" once their corresponding milestone has shipped — until then they're aspirational, not blocking.

### 1.1 Automated Tests

| # | Check | Required Result | Status |
|---|-------|----------------|--------|
| AT-1 | `python manage.py test --settings=family_project.settings.ci` passes (CI workflow: `unit-tests.yml`) | 100% pass rate | ☐ |
| AT-2 | Baseline CBV smoke tests exist for every app (200 authenticated / 302 anonymous) — [#293](https://github.com/liljoker919/family-app/issues/293) | All views covered | ☐ |
| AT-3 | Playwright UI suite (`playwright.yml`, weekly + manual dispatch) | Reviewed if failing — **not currently a merge gate** (`continue-on-error: true`) | ☐ |

### 1.2 Critical Flows (manual smoke pass)

Walk through create/edit/delete for each app as the logged-in user before a release that touches shared code (settings, base templates, middleware):

| # | App | Flow | Status |
|---|-----|------|--------|
| CF-1 | `vehicles` | Create, edit, delete a vehicle | ☐ |
| CF-2 | `property` | Create/edit a maintenance project; confirm recurrence logic | ☐ |
| CF-3 | `calendar_events` | Dashboard/calendar surfaces maintenance deadlines correctly | ☐ |
| CF-4 | `vacations` | Create, edit, delete a vacation | ☐ |
| CF-5 | `cookbook` | Create, edit, delete a recipe | ☐ |
| CF-6 | `shopping` | Add/complete/delete a shopping item | ☐ |
| CF-7 | `tasks` | Create, edit, complete, delete a family task | ☐ |

### 1.3 Tenant Isolation (blocking once Multi-Tenancy Core / [#34](https://github.com/liljoker919/family-app/milestone/34) ships)

| # | Check | Required Result | Status |
|---|-------|----------------|--------|
| TI-1 | Cross-tenant isolation test suite passes ([#300](https://github.com/liljoker919/family-app/issues/300)) | 0 leaks — User B cannot see User A's records on any model | ☐ |
| TI-2 | `AccountScopedMixin` applied to every ListView/DetailView/UpdateView/DeleteView | Confirmed by code review | ☐ |
| TI-3 | Every CreateView stamps `form.instance.account` in `form_valid()` | Confirmed by code review | ☐ |

### 1.4 Observability & Backups (blocking once Launch Foundations / [#33](https://github.com/liljoker919/family-app/milestone/33) ships)

| # | Check | Required Result | Status |
|---|-------|----------------|--------|
| OB-1 | Sentry receives a test exception in prod ([#292](https://github.com/liljoker919/family-app/issues/292)) | Event visible in Sentry dashboard | ☐ |
| OB-2 | Nightly DB backup job has run successfully in the last 24h and a restore has been test-run at least once ([#294](https://github.com/liljoker919/family-app/issues/294), later [#305](https://github.com/liljoker919/family-app/issues/305) post-Postgres) | Backup file present in S3, restore verified | ☐ |
| OB-3 | Rate limiting active on login (and invite-send, once it exists) ([#295](https://github.com/liljoker919/family-app/issues/295)) | Confirmed via manual throttle test | ☐ |

---

## 2. Rollback Plan

### 2.1 Application Rollback

`deploy.yml` deploys directly to the Lightsail instance via SSH on every push to `main` (after `unit-tests.yml`-equivalent tests pass in the same job). There is no staging environment and no manual approval gate today.

To roll back a bad deploy:

```bash
# On the Lightsail instance (or re-run via the same SSH deploy steps, pointed at an older SHA)
cd /srv/family-app
git fetch origin main
git reset --hard <last-good-sha>
source <(sudo cat /etc/family-app/env)
export DJANGO_SETTINGS_MODULE=family_project.settings.prod
venv/bin/pip install -r requirements.txt --quiet
venv/bin/python manage.py migrate --noinput
venv/bin/python manage.py collectstatic --noinput
sudo systemctl restart family-app
sudo systemctl reload nginx
```

> `git reset --hard` on the server discards any local drift — safe here because `/srv/family-app` is deploy-only, not a working directory anyone edits directly.

### 2.2 Database Rollback

**Today (SQLite):** restore the most recent nightly backup (`deploy/env.example`-configured path, synced to S3 once [#294](https://github.com/liljoker919/family-app/issues/294) ships) by copying it over `db/db.sqlite3` and restarting `family-app`.

**After the Postgres migration ([#35](https://github.com/liljoker919/family-app/milestone/35)):** restore from the most recent `pg_dump` snapshot. The point of no return is the moment a schema migration runs against Postgres in prod — take a fresh `pg_dump` immediately before any migration that alters or drops a column/table, not just nightly.

### 2.3 Point of No Return — Data Migrations

Once a migration has run in production and later code has written new-shape data, reverting the app code without also reverting the schema will break. Before any migration that isn't purely additive (drops a column, renames a field, makes a nullable FK required — e.g. the Multi-Tenancy Core "Migration C" in [#301](https://github.com/liljoker919/family-app/issues/301)):

1. Take a fresh DB backup and confirm it's restorable.
2. Note the pre-migration commit SHA somewhere retrievable (a release note, a tag).
3. Only then deploy.

---

## 3. Pre-Launch Dry-Run

Before opening signups to the public (i.e. before [#307-311](https://github.com/liljoker919/family-app/milestone/36) go live):

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| DR-1 | Create two separate accounts via the real onboarding flow | Each gets its own isolated `FamilyAccount` | ☐ |
| DR-2 | Add data to every module (vehicles, maintenance, calendar, vacations, cookbook, shopping, tasks) under account A | Data saved and scoped to account A | ☐ |
| DR-3 | Log in as account B | None of account A's data is visible anywhere (list views, dashboard, calendar) | ☐ |
| DR-4 | Trigger a Stripe test-mode subscription and cancellation | `is_active` flips correctly on both events | ☐ |
| DR-5 | Request a data export as account A | ZIP arrives with only account A's data | ☐ |
| DR-6 | Request account deletion as account B | Account and its data are removed/anonymized; account A unaffected | ☐ |

---

## 4. Deployment Policy

### 4.1 Current CI Workflows

| Workflow | Trigger | Gate? |
|----------|---------|-------|
| `unit-tests.yml` | Every push + PR | Runs on PRs, but **`main` currently has no branch protection rule** — merging isn't technically blocked on it. Recommend enabling required status checks before public launch (Settings → Branches). |
| `deploy.yml` | Push to `main` | Runs the Django test suite, then deploys straight to Lightsail if tests pass. No manual approval step. |
| `playwright.yml` | Weekly (Sun 23:00 UTC) + manual dispatch | Informational only (`continue-on-error: true`), not a deploy gate. |

### 4.2 Recommended Change Before Public Launch

Enable **branch protection on `main`** requiring the `unit-tests.yml` job to pass before merge, so that `deploy.yml`'s auto-deploy-on-push can't ship an untested commit. This is a gap today because the app has only ever had one trusted operator (you) pushing to `main`; it stops being safe once the app has paying customers depending on uptime.

---

*Last updated: 2026-07-13. Supersedes the pre-2026-07-13 Amplify/DynamoDB draft of this document.*
