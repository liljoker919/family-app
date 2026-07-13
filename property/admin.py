from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import MaintenanceProject, Property


@admin.register(Property)
class PropertyAdmin(SimpleHistoryAdmin):
    list_display = ["name", "property_type", "address"]
    list_filter = ["property_type"]
    search_fields = ["name", "address"]
    history_list_display = ["name", "address"]


@admin.register(MaintenanceProject)
class MaintenanceProjectAdmin(SimpleHistoryAdmin):
    list_display = ["title", "prop", "category", "status", "priority", "due_date", "estimated_cost", "actual_cost"]
    list_filter = ["status", "priority", "category", "prop"]
    search_fields = ["title", "prop__name", "contractor_name"]
    date_hierarchy = "due_date"
    history_list_display = ["status", "priority", "actual_cost"]
