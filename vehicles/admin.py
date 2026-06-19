from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Vehicle, VehicleService


@admin.register(Vehicle)
class VehicleAdmin(SimpleHistoryAdmin):
    list_display = ["__str__", "vin", "license_plate", "current_mileage", "registration_expiry"]
    search_fields = ["make", "model", "vin", "license_plate"]
    history_list_display = ["current_mileage", "registration_expiry"]


@admin.register(VehicleService)
class VehicleServiceAdmin(SimpleHistoryAdmin):
    list_display = ["vehicle", "service_type", "date", "mileage_at_service", "cost", "provider"]
    list_filter = ["service_type", "vehicle"]
    search_fields = ["vehicle__make", "vehicle__model", "provider"]
    date_hierarchy = "date"
    history_list_display = ["service_type", "cost", "mileage_at_service"]
