#!/usr/bin/env bash
# Run once as root (or via sudo) after Terraform provisions the Lightsail instance.
# Usage: sudo bash /tmp/setup.sh
set -euo pipefail

APP_DIR=/srv/family-app
LOG_DIR=/var/log/family-app
ENV_FILE=/etc/family-app/env
REPO_URL=https://github.com/liljoker919/family-app.git

echo "── Installing system packages ───────────────────────────────────────────"
dnf install -y python3 python3-pip python3-devel nginx git

echo "── Creating directories ─────────────────────────────────────────────────"
mkdir -p "$APP_DIR" "$LOG_DIR" /etc/family-app
mkdir -p "$APP_DIR/db"

echo "── Cloning / updating repo ──────────────────────────────────────────────"
if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
fi

echo "── Setting up Python virtual environment ────────────────────────────────"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

echo "── Setting ownership ────────────────────────────────────────────────────"
chown -R ec2-user:ec2-user "$APP_DIR" "$LOG_DIR"

echo "── Checking environment file ────────────────────────────────────────────"
if [ ! -f "$ENV_FILE" ]; then
    cp "$APP_DIR/deploy/env.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo ""
    echo "  ⚠  $ENV_FILE was created from the example template."
    echo "  Edit it now and fill in DJANGO_SECRET_KEY and DJANGO_ALLOWED_HOSTS,"
    echo "  then re-run this script to finish the deployment."
    echo ""
    exit 0
fi

echo "── Running Django migrations ─────────────────────────────────────────────"
cd "$APP_DIR"
sudo -u ec2-user DJANGO_SETTINGS_MODULE=family_project.settings.prod \
    "$APP_DIR/venv/bin/python" manage.py migrate --noinput

echo "── Collecting static files ───────────────────────────────────────────────"
sudo -u ec2-user DJANGO_SETTINGS_MODULE=family_project.settings.prod \
    "$APP_DIR/venv/bin/python" manage.py collectstatic --noinput

echo "── Installing systemd service ────────────────────────────────────────────"
cp "$APP_DIR/deploy/gunicorn.service" /etc/systemd/system/family-app.service
systemctl daemon-reload
systemctl enable family-app
systemctl restart family-app

echo "── Configuring nginx ─────────────────────────────────────────────────────"
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/conf.d/family-app.conf
nginx -t
systemctl enable nginx
systemctl restart nginx

echo ""
echo "✅  Setup complete. App is running at http://$(curl -sf http://checkip.amazonaws.com || echo '<your-ip>')"
echo ""
echo "   Next: create a Django superuser"
echo "   sudo -u ec2-user DJANGO_SETTINGS_MODULE=family_project.settings.prod $APP_DIR/venv/bin/python $APP_DIR/manage.py createsuperuser"
