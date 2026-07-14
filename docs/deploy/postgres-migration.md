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
```

The AL2023 `docker` package does **not** include the Compose plugin. `docker compose version` will fail with `unknown shorthand flag: 'f'` (Docker parses `compose` as an unrecognized subcommand and chokes on the next flag) until you install it — there's no `docker-compose-plugin` package in the default repo either, so install the binary directly:

```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker compose version
```

This installs the plugin for `ec2-user` only — `~/.docker/cli-plugins` is per-user, and `sudo docker compose ...` (running as root) will fail the same way since root has no plugin of its own. **Always run `docker compose` as `ec2-user`, never via `sudo`** — this includes cron jobs and the backup script, which is why `deploy/backup-db-postgres.sh` and its cron entry both run as `ec2-user`.

Also confirm cron is actually installed and running before relying on any cron-based backup — on a fresh AL2023 instance it may not be:

```bash
systemctl status crond   # if "Unit crond.service could not be found":
sudo dnf install -y cronie
sudo systemctl enable --now crond
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

`/etc/family-app/env` is root-owned, mode 600 — `ec2-user` can't read it directly, and `--env-file` needs to open it itself (unlike a plain `source`, which can go through `sudo cat`). Make a temporary readable copy, use it, then delete it:

```bash
cd /srv/family-app
sudo cat /etc/family-app/env > /tmp/family-app-env.tmp
chmod 600 /tmp/family-app-env.tmp

docker compose -f deploy/docker-compose.yml --env-file /tmp/family-app-env.tmp up -d
docker compose -f deploy/docker-compose.yml --env-file /tmp/family-app-env.tmp ps

rm -f /tmp/family-app-env.tmp
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

The cron entry runs `backup-db-postgres.sh` as `ec2-user` (not root) — see the Docker Compose note in step 1 for why. `ec2-user` needs its own AWS credentials for the S3 upload; the `family-app-backup-svc` IAM user's credentials configured for `root` back in the SQLite-era setup won't be picked up. Copy them over rather than minting a new key:

```bash
sudo mkdir -p /home/ec2-user/.aws
sudo cp /root/.aws/credentials /home/ec2-user/.aws/credentials
sudo cp /root/.aws/config /home/ec2-user/.aws/config
sudo chown -R ec2-user:ec2-user /home/ec2-user/.aws
aws sts get-caller-identity   # confirm it shows family-app-backup-svc, no sudo needed
```

Then install the cron job and test it — as `ec2-user`, matching how cron actually invokes it (`sudo`-ing the whole script here would hit the same missing-Compose-plugin-for-root issue from step 1):

```bash
sudo chmod +x /srv/family-app/deploy/backup-db-postgres.sh
sudo cp /srv/family-app/deploy/family-app-backup-postgres.cron /etc/cron.d/family-app-backup
/srv/family-app/deploy/backup-db-postgres.sh   # one manual run to confirm it works — no sudo
ls -la /srv/family-app/backups
```

The old SQLite cron entry is now replaced. Keep the SQLite `.sqlite3` file and the `data_backup.json` export on S3 for at least 90 days as a rollback safety net.

---

## Rollback

**Before step 6 (Postgres switch not yet deployed):** nothing to roll back — SQLite is still live and untouched.

**After step 6, before step 8 completes successfully:** revert the `prod.py` DB-engine commit and redeploy; SQLite is still on disk, untouched. The app comes back up exactly as it was.

**After step 8 (data loaded into Postgres) — cutting back to SQLite:** revert the `prod.py` commit and redeploy. Since no writes have gone to Postgres-only data yet (this is a low-traffic personal app, not a live multi-user cutover), the untouched SQLite file remains authoritative. If real usage has occurred against Postgres by the time a rollback is needed, restore the SQLite file from the step-4 backup instead, accepting loss of anything written only to Postgres in between.
