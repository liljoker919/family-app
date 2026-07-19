from django.contrib import admin
from django.urls import include, path
from invitations.views import AcceptInvite

from core.views import RateLimitedLoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Rate-limited login must come before the auth.urls include so it wins the match.
    path("accounts/login/", RateLimitedLoginView.as_view(), name="login"),
    path("accounts/", include("django.contrib.auth.urls")),
    path("stripe/", include("djstripe.urls", namespace="djstripe")),
    # Only the accept-invite endpoint is wired — send-invite/send-json-invite
    # from invitations.urls are deliberately NOT included, since this app's
    # own rate-limited, tier-capped SendInviteView (core:send_invite) is the
    # only supported way to send an invitation.
    path(
        "invitations/",
        include(([path("accept-invite/<str:key>/", AcceptInvite.as_view(), name="accept-invite")], "invitations")),
    ),
    path("", include("core.urls")),
    path("vehicles/", include("vehicles.urls", namespace="vehicles")),
    path("property/", include("property.urls", namespace="property")),
    path("calendar/", include("calendar_events.urls", namespace="calendar_events")),
    path("vacations/", include("vacations.urls", namespace="vacations")),
    path("cookbook/", include("cookbook.urls", namespace="cookbook")),
    path("shopping/", include("shopping.urls", namespace="shopping")),
    path("tasks/", include("tasks.urls", namespace="tasks")),
]
