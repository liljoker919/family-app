from django.urls import path

from . import views

app_name = "vacations"

urlpatterns = [
    path("", views.VacationListView.as_view(), name="vacation_list"),
    path("new/", views.VacationCreateView.as_view(), name="vacation_create"),
    path("<int:pk>/", views.VacationDetailView.as_view(), name="vacation_detail"),
    path("<int:pk>/edit/", views.VacationUpdateView.as_view(), name="vacation_update"),
    path("<int:pk>/delete/", views.VacationDeleteView.as_view(), name="vacation_delete"),
    # Expenses
    path("<int:vacation_pk>/expenses/add/", views.ExpenseCreateView.as_view(), name="expense_create"),
    path("expenses/<int:pk>/edit/", views.ExpenseUpdateView.as_view(), name="expense_update"),
    path("expenses/<int:pk>/delete/", views.ExpenseDeleteView.as_view(), name="expense_delete"),
    # Reservations
    path("<int:vacation_pk>/reservations/add/", views.ReservationCreateView.as_view(), name="reservation_create"),
    path("reservations/<int:pk>/edit/", views.ReservationUpdateView.as_view(), name="reservation_update"),
    path("reservations/<int:pk>/delete/", views.ReservationDeleteView.as_view(), name="reservation_delete"),
    # Itinerary
    path("<int:vacation_pk>/itinerary/add/", views.ItineraryItemCreateView.as_view(), name="itineraryitem_create"),
    path("itinerary/<int:pk>/edit/", views.ItineraryItemUpdateView.as_view(), name="itineraryitem_update"),
    path("itinerary/<int:pk>/delete/", views.ItineraryItemDeleteView.as_view(), name="itineraryitem_delete"),
]
