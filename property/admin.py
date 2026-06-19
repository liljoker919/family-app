from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Mortgage, Property, PropertyTransaction


@admin.register(Property)
class PropertyAdmin(SimpleHistoryAdmin):
    list_display = ["name", "property_type", "address", "current_value", "purchase_date"]
    list_filter = ["property_type"]
    search_fields = ["name", "address"]
    history_list_display = ["name", "current_value", "purchase_price"]


@admin.register(Mortgage)
class MortgageAdmin(SimpleHistoryAdmin):
    list_display = ["prop", "lender", "current_balance", "interest_rate", "monthly_payment", "start_date"]
    list_filter = ["lender"]
    search_fields = ["prop__name", "lender"]
    history_list_display = ["current_balance", "lender"]


@admin.register(PropertyTransaction)
class PropertyTransactionAdmin(SimpleHistoryAdmin):
    list_display = ["prop", "category", "amount", "date", "description"]
    list_filter = ["category", "prop"]
    search_fields = ["description", "prop__name"]
    date_hierarchy = "date"
    history_list_display = ["category", "amount"]
