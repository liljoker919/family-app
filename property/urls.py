from django.urls import path

from . import views

app_name = "property"

urlpatterns = [
    path("", views.PropertyListView.as_view(), name="property_list"),
    path("add/", views.PropertyCreateView.as_view(), name="property_create"),
    path("<int:pk>/", views.PropertyDetailView.as_view(), name="property_detail"),
    path("<int:pk>/edit/", views.PropertyUpdateView.as_view(), name="property_update"),
    path("<int:pk>/delete/", views.PropertyDeleteView.as_view(), name="property_delete"),
    path("<int:property_pk>/transaction/add/", views.TransactionCreateView.as_view(), name="transaction_create"),
    path("transaction/<int:pk>/edit/", views.TransactionUpdateView.as_view(), name="transaction_update"),
    path("transaction/<int:pk>/delete/", views.TransactionDeleteView.as_view(), name="transaction_delete"),
    path("<int:property_pk>/mortgage/add/", views.MortgageCreateView.as_view(), name="mortgage_create"),
    path("mortgage/<int:pk>/edit/", views.MortgageUpdateView.as_view(), name="mortgage_update"),
    path("<int:property_pk>/maintenance/add/", views.MaintenanceProjectCreateView.as_view(), name="maintenance_create"),
    path("maintenance/<int:pk>/edit/", views.MaintenanceProjectUpdateView.as_view(), name="maintenance_update"),
    path("maintenance/<int:pk>/delete/", views.MaintenanceProjectDeleteView.as_view(), name="maintenance_delete"),
]
