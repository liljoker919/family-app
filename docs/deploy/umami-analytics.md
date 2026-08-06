# Self-Hosted Umami Analytics Setup (#358)

Cookieless traffic analytics for the landing page — no consent banner needed
because Umami doesn't set cookies or track visitors across sites. Runs as a
second container alongside the existing Postgres one (see
`deploy/docker-compose.yml`), reverse-proxied at `analytics.heyfamlyapp.com`.

Docker and the Compose plugin are already installed on the box from the
Postgres migration (`docs/deploy/postgres-migration.md`) — this doesn't
repeat that setup.

## 1. Point DNS at this box

Add an `A` (or `CNAME`) record for `analytics.heyfamlyapp.com` at your
registrar, same target as the bare domain. Confirm it resolves before
continuing — Certbot's HTTP-01 challenge in step 4 needs it live.

## 2. Set the Umami credentials

Add to `/etc/family-app/env` (see `deploy/env.example`):

```
UMAMI_DB_NAME=umami
UMAMI_DB_USER=umami
UMAMI_DB_PASSWORD=<openssl rand -hex 24>
UMAMI_APP_SECRET=<openssl rand -hex 32>
UMAMI_WEBSITE_ID=
```

Use a fresh `openssl rand -hex 24` for `UMAMI_DB_PASSWORD` rather than
reusing `DB_PASSWORD` — it goes into a `postgresql://` connection-string
URL, and hex output is guaranteed free of characters (`/`, `@`, `:`) that
break URL parsing. A `/` in a reused password is exactly what broke this
the first time it was set up.

Leave `UMAMI_WEBSITE_ID` blank for now — it's generated in step 6, after
Umami is actually running.

## 3. Create the `umami` database and role

Umami needs its own database and a dedicated role inside the
already-running Postgres container — not a second Postgres instance, and
not the main app's `family_app` role. Find the container name, then create
both (use the exact same password you put in `UMAMI_DB_PASSWORD` above):

```bash
docker ps --filter name=postgres --format '{{.Names}}'
docker exec -it <postgres-container-name> psql -U family_app -c "CREATE DATABASE umami;"
docker exec -it <postgres-container-name> psql -U family_app -c "CREATE USER umami WITH PASSWORD '<same-value-as-UMAMI_DB_PASSWORD>';"
docker exec -it <postgres-container-name> psql -U family_app -c "ALTER DATABASE umami OWNER TO umami;"
```

## 4. Start the Umami container

Same env-file-copy pattern as the Postgres setup (`/etc/family-app/env` is
root-owned, `--env-file` needs to read it directly):

```bash
cd /srv/family-app
sudo cat /etc/family-app/env > /tmp/family-app-env.tmp
chmod 600 /tmp/family-app-env.tmp

docker compose -f deploy/docker-compose.yml --env-file /tmp/family-app-env.tmp up -d umami
docker compose -f deploy/docker-compose.yml --env-file /tmp/family-app-env.tmp ps

rm -f /tmp/family-app-env.tmp
```

Confirm the `umami` service shows as running (it self-migrates its schema
on first boot — no separate migration step). If it's not, check logs:

```bash
docker compose -f deploy/docker-compose.yml logs umami
```

## 5. Wire up nginx + TLS

```bash
sudo cp /srv/family-app/deploy/nginx-analytics.conf /etc/nginx/conf.d/analytics.conf
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d analytics.heyfamlyapp.com --non-interactive --agree-tos -m <your-email>
sudo nginx -t && sudo systemctl reload nginx
```

(The main domain's cert and this one are separate — no need to touch the
existing `heyfamlyapp.com` cert. `certbot-renew.timer`, already enabled per
`docs/deploy/tls-certbot.md`, picks this one up automatically too.)

Verify:
```bash
curl -sI https://analytics.heyfamlyapp.com/ | grep -i http
```

## 6. First-run Umami setup + get the website ID

Visit `https://analytics.heyfamlyapp.com` in a browser. Default login is
`admin` / `umami` — **change this password immediately** under
Settings → Profile.

Then: Settings → Websites → Add website, name it `Hey Famly`, domain
`heyfamlyapp.com`. After saving, open it and copy the **Website ID** (a
UUID) from its tracking-code snippet.

## 7. Turn tracking on

Add the copied ID to `/etc/family-app/env`:

```
UMAMI_WEBSITE_ID=<the-uuid-from-step-6>
```

Then restart the app so it picks up the new env var:

```bash
sudo systemctl restart family-app
```

The landing page (`templates/core/landing.html`) now renders the tracking
script. Visit `heyfamlyapp.com` once and confirm a pageview shows up on the
Umami dashboard's Realtime view.

## Rollback

Blank out `UMAMI_WEBSITE_ID` in `/etc/family-app/env` and
`sudo systemctl restart family-app` — the script tag stops rendering
immediately, no redeploy needed. The `umami` container can keep running
harmlessly in the background, or `docker compose stop umami` to free the
resources.
