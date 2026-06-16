from django.contrib import admin

from .models import Vehicle, VehicleService


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["__str__", "vin", "license_plate", "current_mileage", "registration_expiry"]
    search_fields = ["make", "model", "vin", "license_plate"]


@admin.register(VehicleService)
class VehicleServiceAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "service_type", "date", "mileage_at_service", "cost", "provider"]
    list_filter = ["service_type", "vehicle"]
    search_fields = ["vehicle__make", "vehicle__model", "provider"]
