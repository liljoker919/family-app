# Legix Export Format

Before the rental financial/CRM models are removed from family-app (GitHub milestone
[#31](https://github.com/liljoker919/family-app/milestone/31)), run the export command
to capture the data for import into legix:

```bash
python manage.py export_rental_data --output-dir /path/to/exports
```

This writes four timestamped JSON files:

| File | Source model | Notes |
|------|-------------|-------|
| `mortgages-<timestamp>.json` | `property.Mortgage` | One row per property with a mortgage on file |
| `property_transactions-<timestamp>.json` | `property.PropertyTransaction` | Full income/expense ledger, including the `RENT_INCOME` rows auto-created by bookings |
| `guests-<timestamp>.json` | `property.Guest` | CRM contact records |
| `guest_bookings-<timestamp>.json` | `property.GuestBooking` | Booking records, denormalized with guest/property identifiers |

## Field notes

Every export denormalizes its FK relationships (property name/address, guest name/email)
so each row is self-contained once the source models no longer exist in this repo —
legix doesn't need to resolve family-app's internal primary keys.

- **Dates** (`start_date`, `end_date`, `deposit_due`, `balance_due`) are ISO 8601
  strings (`YYYY-MM-DD`).
- **Money fields** (`amount`, `total_cost`, `original_amount`, etc.) are strings holding
  the exact decimal value (e.g. `"800.00"`), not floats — parse with a `Decimal`, not
  `float()`, to avoid rounding drift.
- `category` on `property_transactions` is the raw choice key (e.g. `RENT_INCOME`);
  `category_display` is the human-readable label, included for convenience only —
  import against `category`, not `category_display`.
- `id` fields are family-app's internal primary keys, included for traceability during
  the migration only. legix should assign its own IDs on import.

## Running this in production

The export must be run against the real Lightsail database, not a local dev copy:

```bash
cd /srv/family-app
sudo -u ec2-user DJANGO_SETTINGS_MODULE=family_project.settings.prod \
    venv/bin/python manage.py export_rental_data --output-dir /srv/family-app/exports
```

Copy the resulting JSON files off the box (e.g. `scp` or upload to S3) before the
removal migrations in milestone #31 run — those migrations drop the source tables.

Also take a full database backup immediately before deploying the removal migrations
(not just these four tables) — run the existing nightly job on demand rather than
waiting for its 3am schedule:

```bash
sudo /srv/family-app/deploy/backup-db.sh
```

See `LAUNCH_CHECKLIST.md` §2.3 ("Point of No Return — Data Migrations") for the full
pre-migration checklist.
