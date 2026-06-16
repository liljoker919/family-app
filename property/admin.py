from django.contrib import admin

from .models import Property, PropertyTransaction


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ["name", "property_type", "address"]
    list_filter = ["property_type"]
    search_fields = ["name", "address"]


@admin.register(PropertyTransaction)
class PropertyTransactionAdmin(admin.ModelAdmin):
    list_display = ["prop", "category", "amount", "date", "description"]
    list_filter = ["category", "prop"]
    search_fields = ["description", "prop__name"]
    date_hierarchy = "date"
