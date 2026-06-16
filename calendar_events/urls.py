from django.urls import path

from . import views

app_name = "calendar_events"

urlpatterns = [
    path("", views.CalendarView.as_view(), name="calendar"),
    path("events.json", views.calendar_json_view, name="events_json"),
    path("event/add/", views.EventCreateView.as_view(), name="event_create"),
    path("event/<int:pk>/edit/", views.EventUpdateView.as_view(), name="event_update"),
    path("event/<int:pk>/delete/", views.EventDeleteView.as_view(), name="event_delete"),
]
