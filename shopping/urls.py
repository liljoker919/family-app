from django.urls import path

from . import views

app_name = "shopping"

urlpatterns = [
    path("", views.ShoppingListView.as_view(), name="list"),
    path("add/", views.ShoppingItemCreateView.as_view(), name="item_create"),
    path("<int:pk>/edit/", views.ShoppingItemUpdateView.as_view(), name="item_update"),
    path("<int:pk>/delete/", views.ShoppingItemDeleteView.as_view(), name="item_delete"),
    path("recipe/<int:recipe_pk>/add/", views.add_recipe_ingredients, name="add_recipe"),
]
