from django.contrib import admin

from .models import ShoppingItem


@admin.register(ShoppingItem)
class ShoppingItemAdmin(admin.ModelAdmin):
    list_display = ("name", "quantity", "unit", "category", "is_purchased", "source_recipe", "added_at")
    list_filter = ("category", "is_purchased")
    search_fields = ("name",)
    list_editable = ("is_purchased",)
