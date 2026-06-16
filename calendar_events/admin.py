from django.contrib import admin

from .models import CalendarEvent


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "start", "end", "all_day"]
    list_filter = ["event_type", "all_day"]
    search_fields = ["title", "notes"]
    date_hierarchy = "start"
