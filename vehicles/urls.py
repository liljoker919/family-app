from django.urls import path

from . import views

app_name = "vehicles"

urlpatterns = [
    path("", views.VehicleListView.as_view(), name="vehicle_list"),
    path("add/", views.VehicleCreateView.as_view(), name="vehicle_create"),
    path("<int:pk>/", views.VehicleDetailView.as_view(), name="vehicle_detail"),
    path("<int:pk>/edit/", views.VehicleUpdateView.as_view(), name="vehicle_update"),
    path("<int:pk>/delete/", views.VehicleDeleteView.as_view(), name="vehicle_delete"),
    path("<int:vehicle_pk>/service/add/", views.ServiceCreateView.as_view(), name="service_create"),
    path("service/<int:pk>/edit/", views.ServiceUpdateView.as_view(), name="service_update"),
    path("service/<int:pk>/delete/", views.ServiceDeleteView.as_view(), name="service_delete"),
]
