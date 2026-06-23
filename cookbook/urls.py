from django.urls import path

from . import views

app_name = "cookbook"

urlpatterns = [
    path("", views.RecipeListView.as_view(), name="recipe_list"),
    path("add/", views.RecipeCreateView.as_view(), name="recipe_create"),
    path("<int:pk>/", views.RecipeDetailView.as_view(), name="recipe_detail"),
    path("<int:pk>/edit/", views.RecipeUpdateView.as_view(), name="recipe_update"),
    path("<int:pk>/delete/", views.RecipeDeleteView.as_view(), name="recipe_delete"),
    # Ingredients
    path("<int:recipe_pk>/ingredients/add/", views.IngredientCreateView.as_view(), name="ingredient_create"),
    path("ingredient/<int:pk>/edit/", views.IngredientUpdateView.as_view(), name="ingredient_update"),
    path("ingredient/<int:pk>/delete/", views.IngredientDeleteView.as_view(), name="ingredient_delete"),
    # Steps
    path("<int:recipe_pk>/steps/add/", views.StepCreateView.as_view(), name="step_create"),
    path("step/<int:pk>/edit/", views.StepUpdateView.as_view(), name="step_update"),
    path("step/<int:pk>/delete/", views.StepDeleteView.as_view(), name="step_delete"),
]
