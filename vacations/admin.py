from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import ItineraryItem, Reservation, Vacation, VacationExpense


class ExpenseInline(admin.TabularInline):
    model = VacationExpense
    extra = 0


class ReservationInline(admin.TabularInline):
    model = Reservation
    extra = 0


class ItineraryInline(admin.TabularInline):
    model = ItineraryItem
    extra = 0


@admin.register(Vacation)
class VacationAdmin(SimpleHistoryAdmin):
    list_display = ["name", "destination", "start_date", "end_date", "status"]
    list_filter = ["status"]
    search_fields = ["name", "destination"]
    inlines = [ExpenseInline, ReservationInline, ItineraryInline]
    history_list_display = ["name", "status", "destination"]


@admin.register(VacationExpense)
class VacationExpenseAdmin(SimpleHistoryAdmin):
    list_display = ["vacation", "date", "category", "description", "amount", "paid_by"]
    list_filter = ["category", "vacation"]
    search_fields = ["description", "vacation__name", "paid_by"]
    date_hierarchy = "date"
    history_list_display = ["category", "amount", "paid_by"]


@admin.register(Reservation)
class ReservationAdmin(SimpleHistoryAdmin):
    list_display = ["vacation", "type", "provider", "confirmation_number", "departure_time"]
    list_filter = ["type", "vacation"]
    search_fields = ["provider", "confirmation_number", "vacation__name"]
    history_list_display = ["type", "provider", "confirmation_number"]
