from django.db import models


_CATEGORY_KEYWORDS = {
    "PRODUCE": ["apple", "banana", "carrot", "celery", "garlic", "ginger", "lemon", "lettuce",
                "lime", "onion", "pepper", "potato", "spinach", "tomato", "cucumber", "broccoli",
                "zucchini", "mushroom", "avocado", "berry", "grape", "mango", "orange", "herb",
                "basil", "cilantro", "parsley", "thyme", "rosemary", "scallion", "shallot"],
    "MEAT": ["beef", "chicken", "pork", "turkey", "salmon", "shrimp", "tuna", "lamb", "bacon",
             "sausage", "ham", "steak", "ground", "fillet", "breast", "thigh", "wing", "rib",
             "brisket", "chorizo", "pepperoni", "prosciutto", "anchov"],
    "DAIRY": ["butter", "cheese", "cream", "egg", "milk", "yogurt", "sour cream", "cheddar",
              "mozzarella", "parmesan", "ricotta", "feta", "brie", "whipping", "half and half",
              "buttermilk", "ghee"],
    "BAKERY": ["bread", "bun", "roll", "tortilla", "wrap", "pita", "bagel", "baguette",
               "crouton", "breadcrumb"],
    "FROZEN": ["frozen", "ice cream", "popsicle"],
    "HOUSEHOLD": ["soap", "detergent", "paper", "towel", "tissue", "bleach", "sponge",
                  "bag", "wrap", "foil", "parchment"],
}


def _guess_category(name: str) -> str:
    lower = name.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return category
    return "PANTRY"


class ShoppingItem(models.Model):
    CATEGORY_CHOICES = [
        ("PRODUCE", "Produce"),
        ("MEAT", "Meat & Seafood"),
        ("DAIRY", "Dairy & Eggs"),
        ("BAKERY", "Bakery"),
        ("FROZEN", "Frozen"),
        ("PANTRY", "Pantry"),
        ("HOUSEHOLD", "Household"),
        ("OTHER", "Other"),
    ]

    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=20, blank=True)
    unit = models.CharField(max_length=20, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="PANTRY")
    source_recipe = models.ForeignKey(
        "cookbook.Recipe",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="shopping_items",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        parts = []
        if self.quantity:
            parts.append(self.quantity)
        if self.unit:
            parts.append(self.unit)
        parts.append(self.name)
        return " ".join(parts)
