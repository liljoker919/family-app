#!/usr/bin/env bash
# Nightly Postgres backup, run on the Lightsail instance via cron.
# Supersedes deploy/backup-db.sh (SQLite) once the Postgres cutover is complete —
# see docs/deploy/postgres-migration.md.
set -euo pipefail

APP_DIR=/srv/family-app
BACKUP_DIR="$APP_DIR/backups"
ENV_FILE=/etc/family-app/env
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

set -a
source <(sudo cat "$ENV_FILE")
set +a

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pg-$TIMESTAMP.sql.gz"

docker compose -f "$APP_DIR/deploy/docker-compose.yml" --env-file "$ENV_FILE" \
    exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

find "$BACKUP_DIR" -name "pg-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    aws s3 cp "$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/family-app-db/"
fi
