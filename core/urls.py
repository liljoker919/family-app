from django.urls import path

from .views import DashboardView, UpgradeRequiredView

app_name = "core"

urlpatterns = [
    path("", DashboardView.as_view(), name="dashboard"),
    path("upgrade/", UpgradeRequiredView.as_view(), name="upgrade_required"),
]
