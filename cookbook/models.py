from django.db import models
from simple_history.models import HistoricalRecords


class Recipe(models.Model):
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
