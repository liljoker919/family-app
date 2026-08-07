# Hey Famly

A shared home for everything a family runs on — vehicles, home maintenance, a calendar, vacations, recipes, a shopping list, and a task board — built with **Django**. Public site: [heyfamlyapp.com](https://heyfamlyapp.com).

## Features

- **Vehicles** — service history, mileage, and registration-expiration reminders for every car in the household.
- **Maintenance** — properties with recurring maintenance projects (contractor info, due dates, auto-recurring schedules).
- **Calendar** — a unified view aggregating manual events, vehicle service dates, maintenance deadlines, vacation windows, and task due dates, plus optional read-only Google/Outlook iCal sync.
- **Vacations** — itineraries, reservations, and expenses per trip.
- **Cookbook** — recipes with ingredients and steps; one tap adds a recipe's ingredients to the shopping list.
- **Tasks** — a Kanban-style board (To Do / In Progress / Done), assignable to family members.
- **Shopping** — a shared list, auto-categorized by item name.
- **Dashboard** — a daily command center: what's overdue or needs attention, today & tomorrow's schedule, a dinner suggestion, priority tasks, and vehicle/property health, instead of a static module directory.

Multi-tenant: each signup creates a `FamilyAccount`; members join via invite. Free tier covers tasks and shopping; a paid Family tier (Stripe) unlocks every module and unlimited members.

## Technology Stack

- **Backend**: Django 5.2, server-rendered templates (Tailwind via CDN, no frontend build step)
- **Database**: PostgreSQL in production (Docker container), SQLite for local development
- **Auth**: Django's built-in session-based auth, plus `django-invitations` for member invites
- **Billing**: Stripe via `dj-stripe`
- **Email**: Amazon SES (`django-ses`) for transactional mail
- **Error tracking**: Sentry
- **Analytics**: self-hosted [Umami](https://umami.is) (cookieless, no consent banner required)
- **Hosting**: AWS Lightsail (Amazon Linux 2023) — gunicorn + nginx + Let's Encrypt/Certbot, provisioned with Terraform (`infra/`)

## Prerequisites

- Python 3.11+
- pip / venv

## Local Setup

```bash
git clone https://github.com/liljoker919/family-app.git
cd family-app

python -m venv .venv
.venv/Scripts/activate   # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

cp deploy/env.example .env   # only needed if you want to exercise Stripe/SES/Sentry locally
python manage.py migrate --settings=family_project.settings.dev
python manage.py createsuperuser --settings=family_project.settings.dev
python manage.py runserver --settings=family_project.settings.dev
```

The dev settings module uses a local SQLite database and requires no external services to run the core app.

## Project Structure

```
family-app/
├── core/              # Accounts, FamilyAccount/tenancy, billing, onboarding, dashboard
├── vehicles/          # Vehicles + service records
├── property/          # Properties + maintenance projects
├── calendar_events/   # Manual events, external iCal feed sync, unified calendar aggregation
├── vacations/         # Vacations, reservations, itinerary, expenses
├── cookbook/          # Recipes, ingredients, steps
├── tasks/             # Family task board
├── shopping/          # Shopping list
├── family_project/    # Django settings (base/dev/ci/prod) and root URLconf
├── templates/         # Server-rendered templates, one directory per app
├── static/            # Static assets (images, logos)
├── deploy/            # nginx configs, systemd unit, docker-compose (Postgres + Umami), env template
├── docs/deploy/        # Box-side setup runbooks (TLS, Postgres migration, Umami)
└── infra/             # Terraform for the Lightsail instance
```

## Testing

```bash
python manage.py test --settings=family_project.settings.ci
```

Two GitHub Actions workflows gate every push/PR to `main`:

| Workflow | What it does |
|----------|---------------|
| **Unit Tests** | Runs the full Django test suite |
| **Security Scan** | `bandit` (static analysis) + `pip-audit` (dependency CVEs), report-only for now |

Dependabot checks `pip` and GitHub Actions dependencies weekly.

## Deployment

Pushing to `main` runs the test suite, then deploys to the AWS Lightsail box over SSH: pulls the latest code, installs dependencies, runs migrations, collects static files, and restarts gunicorn/nginx (`.github/workflows/deploy.yml`). Infrastructure (the Lightsail instance itself) is provisioned via Terraform in `infra/`; see `docs/deploy/` for one-time box setup steps (TLS, Postgres-in-Docker, self-hosted analytics).

## License

MIT — see [LICENSE](./LICENSE).

## Author

liljoker919
