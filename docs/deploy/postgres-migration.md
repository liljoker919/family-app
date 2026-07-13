# SQLite → Postgres Migration Runbook

Covers the full cutover from SQLite to Postgres running in a Docker container on
the existing Lightsail instance (GitHub milestone #35). Do these steps in order,
directly on the production box, **before** deploying the branch that switches
`prod.py` to the Postgres engine.

---

## 1. Install Docker

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Log out and back in (or start a new SSH session) for the group change to apply
docker compose version
```

## 2. Set the Postgres credentials

Add to `/etc/family-app/env` (see `deploy/env.example` for the full list of new vars):

```
DB_NAME=family_app
DB_USER=family_app
DB_PASSWORD=<generate a long random string>
DB_HOST=127.0.0.1
DB_PORT=5432
```

## 3. Start the Postgres container

```bash
cd /srv/family-app
docker compose -f deploy/docker-compose.yml --env-file /etc/family-app/env up -d
docker compose -f deploy/docker-compose.yml --env-file /etc/family-app/env ps
```

Confirm it shows healthy before continuing.

## 4. Back up the current SQLite database

Non-negotiable — this is the point of no return for the old database file.

```bash
sudo /srv/family-app/deploy/backup-db.sh
ls -la /srv/family-app/backups
```

## 5. Export all data from SQLite (still running on the current, pre-Postgres deploy)

```bash
cd /srv/family-app
set -a; source <(sudo cat /etc/family-app/env); set +a
export DJANGO_SETTINGS_MODULE=family_project.settings.prod
# NOTE: at this point prod.py must still point at SQLite — run this BEFORE
# merging/deploying the branch that switches DATABASES to Postgres.
venv/bin/python manage.py dumpdata \
    --natural-foreign --natural-primary \
    --exclude contenttypes --exclude auth.permission --exclude admin.logentry --exclude sessions \
    --indent 2 \
    > /srv/family-app/data_backup.json

wc -l /srv/family-app/data_backup.json
```

Copy `data_backup.json` off the box too (e.g. to S3), same as the legix export — it's your only portable copy of every table's data.

## 6. Merge and deploy the Postgres-switch branch

Once the export above is confirmed, merge the PR that switches `prod.py`'s `DATABASES` to Postgres and adds `psycopg2-binary`. The next `deploy.yml` run installs the new dependency and restarts gunicorn — but the app **will not come up successfully yet**, because the Postgres database has no schema. That's expected; continue immediately with step 7.

## 7. Run migrations against the empty Postgres database

```bash
cd /srv/family-app
set -a; source <(sudo cat /etc/family-app/env); set +a
export DJANGO_SETTINGS_MODULE=family_project.settings.prod
venv/bin/python manage.py migrate --noinput
```

## 8. Load the data into Postgres

```bash
venv/bin/python manage.py loaddata /srv/family-app/data_backup.json
```

## 9. Verify row counts match

For each app's key models, spot-check counts against the original SQLite backup (open a second shell pointed at the SQLite backup file if needed, or compare against the `dumpdata` output's object count per model):

```bash
venv/bin/python manage.py shell -c "
from django.contrib.auth import get_user_model
from vehicles.models import Vehicle
from property.models import Property, MaintenanceProject
from vacations.models import Vacation
from cookbook.models import Recipe
from shopping.models import ShoppingItem
from tasks.models import FamilyTask
from core.models import FamilyAccount, FamilyMembership
User = get_user_model()
for m in [User, Vehicle, Property, MaintenanceProject, Vacation, Recipe, ShoppingItem, FamilyTask, FamilyAccount, FamilyMembership]:
    print(m.__name__, m.objects.count())
"
```

## 10. Restart and smoke test

```bash
sudo systemctl restart family-app
sudo systemctl status family-app
```

Log in via the browser and click through the dashboard, a vehicle, a maintenance item, and the calendar — confirm real data shows up.

## 11. Switch backups over to Postgres

```bash
sudo chmod +x /srv/family-app/deploy/backup-db-postgres.sh
sudo cp /srv/family-app/deploy/family-app-backup-postgres.cron /etc/cron.d/family-app-backup
sudo /srv/family-app/deploy/backup-db-postgres.sh   # one manual run to confirm it works
```

The old SQLite cron entry is now replaced. Keep the SQLite `.sqlite3` file and the `data_backup.json` export on S3 for at least 90 days as a rollback safety net.

---

## Rollback

**Before step 6 (Postgres switch not yet deployed):** nothing to roll back — SQLite is still live and untouched.

**After step 6, before step 8 completes successfully:** revert the `prod.py` DB-engine commit and redeploy; SQLite is still on disk, untouched. The app comes back up exactly as it was.

**After step 8 (data loaded into Postgres) — cutting back to SQLite:** revert the `prod.py` commit and redeploy. Since no writes have gone to Postgres-only data yet (this is a low-traffic personal app, not a live multi-user cutover), the untouched SQLite file remains authoritative. If real usage has occurred against Postgres by the time a rollback is needed, restore the SQLite file from the step-4 backup instead, accepting loss of anything written only to Postgres in between.
