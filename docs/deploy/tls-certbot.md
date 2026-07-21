# TLS / Certbot setup

Run this once, after `deploy/setup.sh` has completed and `heyfamlyapp.com`'s DNS
is actually pointed at the box (Certbot's HTTP-01 challenge needs the domain
resolving to this instance to issue a certificate).

**Background (#344):** this step was originally done manually and never fed
back into `deploy/setup.sh` or `deploy/nginx.conf`, so those files drifted from
what's actually running in production — a from-scratch rebuild using only the
checked-in files would have silently come up HTTP-only. This doc + the
`server_name` fix in `deploy/nginx.conf` close that gap.

## 1. Install Certbot and the nginx plugin

```bash
sudo dnf install -y certbot python3-certbot-nginx
```

## 2. Obtain the certificate and let Certbot wire up nginx

```bash
sudo certbot --nginx -d heyfamlyapp.com --non-interactive --agree-tos -m <your-email>
```

This does two things in one step:
- Issues the certificate to `/etc/letsencrypt/live/heyfamlyapp.com/`.
- Rewrites `/etc/nginx/conf.d/family-app.conf` in place — adds a `listen 443 ssl` server block with the `ssl_certificate`/`ssl_certificate_key` directives, and turns the existing `listen 80` block into a `301` redirect to HTTPS.

Verify:
```bash
sudo nginx -t
sudo certbot certificates
```

## 3. Enable auto-renewal

The `certbot` RPM on Amazon Linux 2023 ships its own systemd timer, but it
**does not enable it by default** — this was the actual gap found in #344: the
cert was live and working, but nothing was renewing it, 55 days from expiry
with zero warning.

```bash
sudo systemctl enable --now certbot-renew.timer
```

Confirm it's actually scheduled:
```bash
systemctl list-timers | grep -i certbot
```

Confirm renewal genuinely works end-to-end (safe — doesn't touch the live cert):
```bash
sudo certbot renew --dry-run
```
Expect: `Congratulations, all simulated renewals succeeded`.

## 4. Sync `deploy/nginx.conf` if you ever hand-edit the live config again

If Certbot or anyone else modifies `/etc/nginx/conf.d/family-app.conf`
directly on the box in the future, copy the result back into
`deploy/nginx.conf` in the repo — this file is what a from-scratch rebuild
uses, and it silently drifting from reality is exactly what happened here.
