from django.conf import settings


def umami(request):
    """Exposes the self-hosted Umami website ID to every template (#358).
    Empty until UMAMI_WEBSITE_ID is set in prod's env — templates gate the
    tracking script on this being truthy, so analytics stays inert until
    the box-side setup (docs/deploy/umami-analytics.md) is actually done."""
    return {"UMAMI_WEBSITE_ID": getattr(settings, "UMAMI_WEBSITE_ID", "")}
