from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from cookbook.models import Ingredient, Recipe
from shopping.models import ShoppingItem, _guess_category

User = get_user_model()


class GuessCategoryTest(TestCase):
    # ── Produce ───────────────────────────────────────────────────────────────

    def test_spinach_is_produce(self):
        self.assertEqual(_guess_category("spinach"), "PRODUCE")

    def test_tomato_is_produce(self):
        self.assertEqual(_guess_category("Roma tomato"), "PRODUCE")

    def test_garlic_is_produce(self):
        self.assertEqual(_guess_category("garlic cloves"), "PRODUCE")

    # ── Meat ─────────────────────────────────────────────────────────────────

    def test_chicken_is_meat(self):
        self.assertEqual(_guess_category("chicken breast"), "MEAT")

    def test_ground_beef_is_meat(self):
        self.assertEqual(_guess_category("ground beef"), "MEAT")

    def test_bacon_is_meat(self):
        self.assertEqual(_guess_category("bacon strips"), "MEAT")

    # ── Dairy ────────────────────────────────────────────────────────────────

    def test_butter_is_dairy(self):
        self.assertEqual(_guess_category("butter"), "DAIRY")

    def test_cheese_is_dairy(self):
        self.assertEqual(_guess_category("cheddar cheese"), "DAIRY")

    def test_milk_is_dairy(self):
        self.assertEqual(_guess_category("whole milk"), "DAIRY")

    # ── Fallback ─────────────────────────────────────────────────────────────

    def test_unknown_ingredient_defaults_to_pantry(self):
        self.assertEqual(_guess_category("quinoa"), "PANTRY")

    def test_soy_sauce_defaults_to_pantry(self):
        self.assertEqual(_guess_category("soy sauce"), "PANTRY")

    def test_case_insensitive_matching(self):
        self.assertEqual(_guess_category("SPINACH"), "PRODUCE")
        self.assertEqual(_guess_category("Chicken Breast"), "MEAT")


class AddRecipeIngredientsTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.account = FamilyAccount.objects.create(
            name="Test Family", slug="test-family-1", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="testuser", password="testpass")
        self.recipe = Recipe.objects.create(account=self.account, title="Test Recipe", category="DINNER")
        Ingredient.objects.create(recipe=self.recipe, name="Chicken", quantity=2, unit="POUND")
        Ingredient.objects.create(recipe=self.recipe, name="Garlic", quantity=3, unit="PIECE")

    def _post(self, recipe_pk=None):
        pk = recipe_pk or self.recipe.pk
        return self.client.post(reverse("shopping:add_recipe", kwargs={"recipe_pk": pk}))

    def test_imports_all_ingredients(self):
        self._post()
        self.assertEqual(ShoppingItem.objects.count(), 2)

    def test_sets_source_recipe_fk(self):
        self._post()
        self.assertTrue(
            ShoppingItem.objects.filter(name="Chicken", source_recipe=self.recipe).exists()
        )

    def test_category_auto_detected(self):
        self._post()
        self.assertEqual(ShoppingItem.objects.get(name="Chicken").category, "MEAT")
        self.assertEqual(ShoppingItem.objects.get(name="Garlic").category, "PRODUCE")

    def test_skips_existing_name_case_insensitive(self):
        ShoppingItem.objects.create(account=self.account, name="chicken", category="MEAT")
        self._post()
        # "Chicken" already on list (case-insensitive) — only Garlic added
        self.assertEqual(ShoppingItem.objects.count(), 2)

    def test_redirects_to_recipe_detail(self):
        response = self._post()
        self.assertRedirects(
            response,
            reverse("cookbook:recipe_detail", kwargs={"pk": self.recipe.pk}),
        )

    def test_empty_recipe_creates_no_items(self):
        empty = Recipe.objects.create(account=self.account, title="Empty", category="LUNCH")
        self._post(recipe_pk=empty.pk)
        self.assertEqual(ShoppingItem.objects.count(), 0)

    def test_unauthenticated_redirects_to_login(self):
        self.client.logout()
        response = self._post()
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])


class ShoppingListViewTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="shopper", password="pass")
        self.account = FamilyAccount.objects.create(name="Shopper Family", slug="shopper-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="shopper", password="pass")
        ShoppingItem.objects.create(account=self.account, name="Apples", category="PRODUCE")
        ShoppingItem.objects.create(account=self.account, name="Sourdough", category="BAKERY")

    def test_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("shopping:list"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_returns_200_and_lists_items(self):
        response = self.client.get(reverse("shopping:list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Apples")
        self.assertContains(response, "Sourdough")


class ShoppingItemCRUDTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="shopper2", password="pass")
        self.account = FamilyAccount.objects.create(name="Shopper2 Family", slug="shopper2-family", owner=self.user)
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="shopper2", password="pass")
        self.item = ShoppingItem.objects.create(account=self.account, name="Milk", category="DAIRY")

    def test_create_adds_item_and_redirects_to_list(self):
        response = self.client.post(
            reverse("shopping:item_create"),
            {"name": "Eggs", "category": "DAIRY"},
        )
        self.assertRedirects(response, reverse("shopping:list"))
        self.assertTrue(ShoppingItem.objects.filter(name="Eggs").exists())

    def test_create_requires_login(self):
        self.client.logout()
        response = self.client.post(
            reverse("shopping:item_create"),
            {"name": "Test Item", "category": "PANTRY"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_update_changes_name_and_redirects_to_list(self):
        response = self.client.post(
            reverse("shopping:item_update", kwargs={"pk": self.item.pk}),
            {"name": "Whole Milk", "category": "DAIRY"},
        )
        self.assertRedirects(response, reverse("shopping:list"))
        self.item.refresh_from_db()
        self.assertEqual(self.item.name, "Whole Milk")

    def test_delete_removes_item_and_redirects_to_list(self):
        response = self.client.post(
            reverse("shopping:item_delete", kwargs={"pk": self.item.pk}),
        )
        self.assertRedirects(response, reverse("shopping:list"))
        self.assertFalse(ShoppingItem.objects.filter(pk=self.item.pk).exists())
