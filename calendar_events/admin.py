from django.contrib import admin

from .models import CalendarEvent, ExternalCalendarFeed


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "start", "end", "all_day"]
    list_filter = ["event_type", "all_day"]
    search_fields = ["title", "notes"]
    date_hierarchy = "start"


@admin.register(ExternalCalendarFeed)
class ExternalCalendarFeedAdmin(admin.ModelAdmin):
    list_display = ["account", "provider", "created_at"]
    list_filter = ["provider"]
    search_fields = ["account__name", "ical_url"]
