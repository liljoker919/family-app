from django.db import models
from simple_history.models import HistoricalRecords


class Recipe(models.Model):
    account = models.ForeignKey(
        "core.FamilyAccount",
        on_delete=models.CASCADE,
        related_name="recipes",
    )
    CATEGORY_CHOICES = [
        ("BREAKFAST", "Breakfast"),
        ("LUNCH", "Lunch"),
        ("DINNER", "Dinner"),
        ("DESSERT", "Dessert"),
        ("SNACK", "Snack"),
        ("OTHER", "Other"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="DINNER")
    prep_time_minutes = models.PositiveIntegerField(default=0)
    cook_time_minutes = models.PositiveIntegerField(default=0)
    servings = models.PositiveIntegerField(default=4)
    is_family_favorite = models.BooleanField(default=False)
    source = models.CharField(max_length=300, blank=True, help_text="e.g. Grandma's card, or a URL")
    created_at = models.DateTimeField(auto_now_add=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title

    @property
    def total_time(self):
        return self.prep_time_minutes + self.cook_time_minutes


class Ingredient(models.Model):
    UNIT_CHOICES = [
        ("CUPS", "Cups"),
        ("TEASPOON", "Teaspoon"),
        ("TABLESPOON", "Tablespoon"),
        ("OUNCE", "Ounce"),
        ("POUND", "Pound"),
        ("GRAM", "Gram"),
        ("PIECE", "Piece"),
        ("TO_TASTE", "To taste"),
        ("OTHER", "Other"),
    ]

    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="ingredients")
    name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        parts = []
        if self.quantity:
            parts.append(str(self.quantity).rstrip("0").rstrip("."))
        if self.unit and self.unit not in ("OTHER", "TO_TASTE"):
            parts.append(self.get_unit_display().lower())
        elif self.unit == "TO_TASTE":
            parts.append("to taste")
        parts.append(self.name)
        return " ".join(parts)


class RecipeStep(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="steps")
    step_number = models.PositiveSmallIntegerField()
    instruction = models.TextField()

    class Meta:
        ordering = ["step_number"]

    def __str__(self):
        return f"Step {self.step_number} — {self.recipe}"


class MealPlan(models.Model):
    """#370 — assigns a Recipe to a specific date, so the dashboard's "What's
    for Dinner" widget can show what's actually planned instead of a random
    suggestion. New code (not subject to Migration C's #301 backfill path),
    so `account` is required from the start, unlike the other modules'
    account FKs."""

    MEAL_TYPE_CHOICES = [
        ("breakfast", "Breakfast"),
        ("lunch", "Lunch"),
        ("dinner", "Dinner"),
    ]

    account = models.ForeignKey("core.FamilyAccount", on_delete=models.CASCADE, related_name="meal_plans")
    date = models.DateField()
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="meal_plans")
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPE_CHOICES, default="dinner")

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["account", "date", "meal_type"], name="unique_account_date_meal_type"),
        ]

    def __str__(self):
        return f"{self.get_meal_type_display()} on {self.date}: {self.recipe}"
