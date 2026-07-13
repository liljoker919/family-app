from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, ListView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin

from .forms import ShoppingItemForm
from .models import ShoppingItem, _guess_category


class ShoppingListView(LoginRequiredMixin, AccountScopedMixin, ListView):
    model = ShoppingItem
    template_name = "shopping/shopping_list.html"
    context_object_name = "items"

    def get_queryset(self):
        return super().get_queryset().select_related("source_recipe")


class ShoppingItemCreateView(LoginRequiredMixin, AccountStampMixin, CreateView):
    model = ShoppingItem
    form_class = ShoppingItemForm
    template_name = "shopping/item_form.html"
    success_url = reverse_lazy("shopping:list")

    def form_valid(self, form):
        messages.success(self.request, f'Added "{form.instance.name}" to your list.')
        return super().form_valid(form)


class ShoppingItemUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = ShoppingItem
    form_class = ShoppingItemForm
    template_name = "shopping/item_form.html"
    success_url = reverse_lazy("shopping:list")


class ShoppingItemDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = ShoppingItem
    template_name = "shopping/item_confirm_delete.html"
    success_url = reverse_lazy("shopping:list")


@login_required
def add_recipe_ingredients(request, recipe_pk):
    from cookbook.models import Recipe
    recipe = get_object_or_404(Recipe, pk=recipe_pk, account=request.account)

    if request.method == "POST":
        ingredients = recipe.ingredients.all()
        existing_names = {
            n.lower() for n in
            ShoppingItem.objects.filter(account=request.account).values_list("name", flat=True)
        }
        added = 0
        skipped = 0
        for ing in ingredients:
            if ing.name.lower() in existing_names:
                skipped += 1
                continue
            qty = str(ing.quantity).rstrip("0").rstrip(".") if ing.quantity else ""
            unit = ""
            if ing.unit and ing.unit not in ("OTHER", "TO_TASTE"):
                unit = ing.get_unit_display().lower()
            ShoppingItem.objects.create(
                account=request.account,
                name=ing.name,
                quantity=qty,
                unit=unit,
                category=_guess_category(ing.name),
                source_recipe=recipe,
            )
            existing_names.add(ing.name.lower())
            added += 1

        if added:
            plural = "s" if added != 1 else ""
            msg = f'Added {added} ingredient{plural} from "{recipe.title}" to your shopping list.'
            if skipped:
                msg += f" {skipped} already on list were skipped."
            messages.success(request, msg)
        else:
            messages.info(request, f'All ingredients from "{recipe.title}" are already on your list.')

    return redirect("cookbook:recipe_detail", pk=recipe_pk)
