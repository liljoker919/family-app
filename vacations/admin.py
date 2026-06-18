from django.contrib import admin

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
class VacationAdmin(admin.ModelAdmin):
    list_display = ["name", "destination", "start_date", "end_date", "status"]
    list_filter = ["status"]
    inlines = [ExpenseInline, ReservationInline, ItineraryInline]
