#!/usr/bin/env bash
# Nightly SQLite backup, run on the Lightsail instance via cron (see family-app-backup.cron).
# Interim measure until the Postgres in Docker Migration milestone lands its own pg_dump job.
set -euo pipefail

APP_DIR=/srv/family-app
DB_PATH="$APP_DIR/db/db.sqlite3"
BACKUP_DIR="$APP_DIR/backups"
ENV_FILE=/etc/family-app/env
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-$TIMESTAMP.sqlite3"

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

find "$BACKUP_DIR" -name "db-*.sqlite3" -mtime "+$RETENTION_DAYS" -delete

if [ -f "$ENV_FILE" ]; then
    BACKUP_S3_BUCKET=$(grep -oP '(?<=^BACKUP_S3_BUCKET=).*' "$ENV_FILE" || true)
    if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
        aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/family-app-db/"
    fi
fi
