from django.contrib import admin

from .models import ShoppingItem


@admin.register(ShoppingItem)
class ShoppingItemAdmin(admin.ModelAdmin):
    list_display = ("name", "quantity", "unit", "category", "source_recipe", "added_at")
    list_filter = ("category",)
    search_fields = ("name",)
