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
]
