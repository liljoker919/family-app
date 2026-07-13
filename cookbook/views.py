from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import AccountScopedMixin, AccountStampMixin, get_scoped_object_or_404

from .forms import IngredientForm, RecipeForm, RecipeStepForm
from .models import Ingredient, Recipe, RecipeStep


class RecipeListView(LoginRequiredMixin, AccountScopedMixin, ListView):
    model = Recipe
    template_name = "cookbook/recipe_list.html"
    context_object_name = "recipes"

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.GET.get("category", "")
        favorites = self.request.GET.get("favorites", "")
        if category:
            qs = qs.filter(category=category)
        if favorites:
            qs = qs.filter(is_family_favorite=True)
        return qs

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["category_choices"] = Recipe.CATEGORY_CHOICES
        context["selected_category"] = self.request.GET.get("category", "")
        context["selected_favorites"] = self.request.GET.get("favorites", "")
        return context


class RecipeDetailView(LoginRequiredMixin, AccountScopedMixin, DetailView):
    model = Recipe
    template_name = "cookbook/recipe_detail.html"
    context_object_name = "recipe"


class RecipeCreateView(LoginRequiredMixin, AccountStampMixin, CreateView):
    model = Recipe
    form_class = RecipeForm
    template_name = "cookbook/recipe_form.html"

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.object.pk})


class RecipeUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = Recipe
    form_class = RecipeForm
    template_name = "cookbook/recipe_form.html"

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.object.pk})


class RecipeDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = Recipe
    template_name = "cookbook/recipe_confirm_delete.html"
    success_url = reverse_lazy("cookbook:recipe_list")


# ── Ingredient CRUD ───────────────────────────────────────────────────────────

class IngredientCreateView(LoginRequiredMixin, CreateView):
    model = Ingredient
    form_class = IngredientForm
    template_name = "cookbook/ingredient_form.html"

    def _get_recipe(self):
        return get_scoped_object_or_404(Recipe, self.request.account, pk=self.kwargs["recipe_pk"])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["recipe"] = self._get_recipe()
        return context

    def form_valid(self, form):
        form.instance.recipe = self._get_recipe()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.kwargs["recipe_pk"]})


class IngredientUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = Ingredient
    form_class = IngredientForm
    template_name = "cookbook/ingredient_form.html"
    account_lookup = "recipe__account"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["recipe"] = self.object.recipe
        return context

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.object.recipe.pk})


class IngredientDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = Ingredient
    template_name = "cookbook/ingredient_confirm_delete.html"
    account_lookup = "recipe__account"

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.object.recipe.pk})


# ── Step CRUD ─────────────────────────────────────────────────────────────────

class StepCreateView(LoginRequiredMixin, CreateView):
    model = RecipeStep
    form_class = RecipeStepForm
    template_name = "cookbook/step_form.html"

    def _get_recipe(self):
        return get_scoped_object_or_404(Recipe, self.request.account, pk=self.kwargs["recipe_pk"])

    def get_initial(self):
        recipe = self._get_recipe()
        next_num = (recipe.steps.order_by("-step_number").values_list("step_number", flat=True).first() or 0) + 1
        return {"step_number": next_num}

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["recipe"] = self._get_recipe()
        return context

    def form_valid(self, form):
        form.instance.recipe = self._get_recipe()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.kwargs["recipe_pk"]})


class StepUpdateView(LoginRequiredMixin, AccountScopedMixin, UpdateView):
    model = RecipeStep
    form_class = RecipeStepForm
    template_name = "cookbook/step_form.html"
    account_lookup = "recipe__account"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["recipe"] = self.object.recipe
        return context

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.object.recipe.pk})


class StepDeleteView(LoginRequiredMixin, AccountScopedMixin, DeleteView):
    model = RecipeStep
    template_name = "cookbook/step_confirm_delete.html"
    account_lookup = "recipe__account"

    def get_success_url(self):
        return reverse_lazy("cookbook:recipe_detail", kwargs={"pk": self.object.recipe.pk})
