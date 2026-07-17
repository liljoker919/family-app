from django.contrib import admin
from django.urls import include, path

from core.views import RateLimitedLoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Rate-limited login must come before the auth.urls include so it wins the match.
    path("accounts/login/", RateLimitedLoginView.as_view(), name="login"),
    path("accounts/", include("django.contrib.auth.urls")),
    path("stripe/", include("djstripe.urls", namespace="djstripe")),
    path("", include("core.urls")),
    path("vehicles/", include("vehicles.urls", namespace="vehicles")),
    path("property/", include("property.urls", namespace="property")),
    path("calendar/", include("calendar_events.urls", namespace="calendar_events")),
    path("vacations/", include("vacations.urls", namespace="vacations")),
    path("cookbook/", include("cookbook.urls", namespace="cookbook")),
    path("shopping/", include("shopping.urls", namespace="shopping")),
    path("tasks/", include("tasks.urls", namespace="tasks")),
]
