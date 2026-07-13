import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from property.models import Guest, GuestBooking, Mortgage, PropertyTransaction


def _json_default(value):
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value)} is not JSON serializable")


class Command(BaseCommand):
    help = (
        "Export rental financial/CRM data (Mortgage, PropertyTransaction, Guest, "
        "GuestBooking) to timestamped JSON files ahead of removing those models "
        "from this repo, so the data can be imported into legix."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            default=str(settings.BASE_DIR / "exports"),
            help="Directory to write the export files into (default: <repo>/exports/).",
        )

    def handle(self, *args, **options):
        output_dir = Path(options["output_dir"])
        output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

        exports = {
            "mortgages": self._export_mortgages(),
            "property_transactions": self._export_transactions(),
            "guests": self._export_guests(),
            "guest_bookings": self._export_bookings(),
        }

        for name, rows in exports.items():
            out_path = output_dir / f"{name}-{timestamp}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(rows, f, indent=2, default=_json_default)
            self.stdout.write(self.style.SUCCESS(f"Wrote {len(rows)} rows to {out_path}"))

    def _export_mortgages(self):
        return [
            {
                "id": m.pk,
                "property_name": m.prop.name if m.prop else None,
                "property_address": m.prop.address if m.prop else None,
                "lender": m.lender,
                "original_amount": m.original_amount,
                "current_balance": m.current_balance,
                "monthly_payment": m.monthly_payment,
                "interest_rate": m.interest_rate,
                "start_date": m.start_date,
                "term_years": m.term_years,
            }
            for m in Mortgage.objects.select_related("prop").all()
        ]

    def _export_transactions(self):
        return [
            {
                "id": t.pk,
                "property_name": t.prop.name,
                "property_address": t.prop.address,
                "category": t.category,
                "category_display": t.get_category_display(),
                "amount": t.amount,
                "description": t.description,
                "date": t.date,
            }
            for t in PropertyTransaction.objects.select_related("prop").all()
        ]

    def _export_guests(self):
        return [
            {
                "id": g.pk,
                "name": g.name,
                "email": g.email,
                "phone": g.phone,
                "notes": g.notes,
            }
            for g in Guest.objects.all()
        ]

    def _export_bookings(self):
        return [
            {
                "id": b.pk,
                "property_name": b.prop.name,
                "property_address": b.prop.address,
                "guest_name": b.guest.name,
                "guest_email": b.guest.email,
                "source": b.source,
                "source_display": b.get_source_display(),
                "start_date": b.start_date,
                "end_date": b.end_date,
                "nights": b.nights,
                "total_cost": b.total_cost,
                "per_night_price": b.per_night_price,
                "deposit_due": b.deposit_due,
                "deposit_amount": b.deposit_amount,
                "deposit_received": b.deposit_received,
                "balance_due": b.balance_due,
                "balance_amount": b.balance_amount,
                "balance_received": b.balance_received,
            }
            for b in GuestBooking.objects.select_related("prop", "guest").all()
        ]
