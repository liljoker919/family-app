from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Ingredient, Recipe, RecipeStep


class IngredientInline(admin.TabularInline):
    model = Ingredient
    extra = 0


class StepInline(admin.TabularInline):
    model = RecipeStep
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(SimpleHistoryAdmin):
    list_display = ["title", "category", "total_time", "servings", "is_family_favorite", "created_at"]
    list_filter = ["category", "is_family_favorite"]
    search_fields = ["title", "description", "source"]
    inlines = [IngredientInline, StepInline]
    history_list_display = ["title", "category", "is_family_favorite"]
