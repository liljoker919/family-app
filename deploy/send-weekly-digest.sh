#!/usr/bin/env bash
# Weekly digest email, run on the Lightsail instance via cron (see
# family-app-digest.cron). Mirrors backup-db.sh's structure (#384).
set -euo pipefail

APP_DIR=/srv/family-app
ENV_FILE=/etc/family-app/env

cd "$APP_DIR"
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
fi

DJANGO_SETTINGS_MODULE=family_project.settings.prod \
    "$APP_DIR/venv/bin/python" manage.py send_weekly_digest
