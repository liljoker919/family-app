from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("django.contrib.auth.urls")),
    path("", include("core.urls")),
    path("vehicles/", include("vehicles.urls", namespace="vehicles")),
    # Module apps wired in as they are built:
    # path("property/", include("property.urls", namespace="property")),
    # path("calendar/", include("calendar_events.urls", namespace="calendar_events")),
]
