import csv
import io
import zipfile

from cookbook.models import Ingredient, Recipe, RecipeStep
from property.models import MaintenanceProject, Property
from shopping.models import ShoppingItem
from tasks.models import FamilyTask, TaskComment
from vacations.models import ItineraryItem, Reservation, Vacation, VacationExpense
from vehicles.models import Vehicle, VehicleService


def _csv_bytes(fields, objects):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(fields)
    for obj in objects:
        writer.writerow([getattr(obj, field) for field in fields])
    return buf.getvalue().encode("utf-8")


def build_export_zip(account):
    """Right to data portability (#319): a ZIP of one CSV per account-scoped
    model, built synchronously in-request. Household data volumes here are
    small enough that a background job + S3 upload would be infrastructure
    the app doesn't otherwise need."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "vehicles.csv",
            _csv_bytes(
                ["id", "year", "make", "model", "vin", "color", "license_plate", "current_mileage", "registration_expiry"],
                Vehicle.objects.filter(account=account),
            ),
        )
        zf.writestr(
            "vehicle_services.csv",
            _csv_bytes(
                ["id", "vehicle_id", "service_type", "description", "date", "mileage_at_service", "cost", "provider"],
                VehicleService.objects.filter(vehicle__account=account),
            ),
        )
        zf.writestr(
            "properties.csv",
            _csv_bytes(
                ["id", "name", "address", "property_type"],
                Property.objects.filter(account=account),
            ),
        )
        zf.writestr(
            "maintenance_projects.csv",
            _csv_bytes(
                [
                    "id", "prop_id", "title", "description", "category", "status", "priority",
                    "estimated_cost", "actual_cost", "due_date", "completion_date",
                    "contractor_name", "contractor_phone", "contractor_notes",
                ],
                MaintenanceProject.objects.filter(prop__account=account),
            ),
        )
        zf.writestr(
            "vacations.csv",
            _csv_bytes(
                ["id", "name", "destination", "start_date", "end_date", "notes", "status"],
                Vacation.objects.filter(account=account),
            ),
        )
        zf.writestr(
            "vacation_expenses.csv",
            _csv_bytes(
                ["id", "vacation_id", "date", "category", "description", "amount", "paid_by"],
                VacationExpense.objects.filter(vacation__account=account),
            ),
        )
        zf.writestr(
            "reservations.csv",
            _csv_bytes(
                ["id", "vacation_id", "type", "provider", "confirmation_number", "departure_time", "arrival_time", "notes"],
                Reservation.objects.filter(vacation__account=account),
            ),
        )
        zf.writestr(
            "itinerary_items.csv",
            _csv_bytes(
                ["id", "vacation_id", "date", "time", "title", "description", "location"],
                ItineraryItem.objects.filter(vacation__account=account),
            ),
        )
        zf.writestr(
            "tasks.csv",
            _csv_bytes(
                ["id", "title", "description", "status", "priority", "assigned_to_id", "due_date", "maintenance_project_id", "created_at"],
                FamilyTask.objects.filter(account=account),
            ),
        )
        zf.writestr(
            "task_comments.csv",
            _csv_bytes(
                ["id", "task_id", "author_id", "body", "created_at"],
                TaskComment.objects.filter(task__account=account),
            ),
        )
        zf.writestr(
            "recipes.csv",
            _csv_bytes(
                [
                    "id", "title", "description", "category", "prep_time_minutes", "cook_time_minutes",
                    "servings", "is_family_favorite", "source", "created_at",
                ],
                Recipe.objects.filter(account=account),
            ),
        )
        zf.writestr(
            "ingredients.csv",
            _csv_bytes(
                ["id", "recipe_id", "name", "quantity", "unit"],
                Ingredient.objects.filter(recipe__account=account),
            ),
        )
        zf.writestr(
            "recipe_steps.csv",
            _csv_bytes(
                ["id", "recipe_id", "step_number", "instruction"],
                RecipeStep.objects.filter(recipe__account=account),
            ),
        )
        zf.writestr(
            "shopping_items.csv",
            _csv_bytes(
                ["id", "name", "quantity", "unit", "category", "source_recipe_id", "added_at"],
                ShoppingItem.objects.filter(account=account),
            ),
        )

    return buf.getvalue()
