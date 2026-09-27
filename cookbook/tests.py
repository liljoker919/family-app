from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from django.utils.timezone import localdate

from cookbook.models import MealPlan, Recipe

User = get_user_model()


class MealPlanViewTest(TestCase):
    def setUp(self):
        from core.models import FamilyAccount, FamilyMembership  # noqa: PLC0415

        self.user = User.objects.create_user(username="planner", password="pass")
        self.account = FamilyAccount.objects.create(
            name="Planner Family", slug="planner-family", owner=self.user, tier=FamilyAccount.TIER_FAMILY,
        )
        FamilyMembership.objects.create(account=self.account, user=self.user, role="owner")
        self.client = Client()
        self.client.login(username="planner", password="pass")
        self.recipe = Recipe.objects.create(account=self.account, title="Tacos", category="DINNER")
        self.monday = localdate() - timedelta(days=localdate().weekday())

    def test_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("cookbook:meal_plan"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login/", response["Location"])

    def test_free_tier_redirects_to_upgrade(self):
        self.account.tier = self.account.TIER_FREE
        self.account.save()
        response = self.client.get(reverse("cookbook:meal_plan"))
        self.assertRedirects(response, reverse("core:upgrade_required"))

    def test_get_returns_200_with_seven_days(self):
        response = self.client.get(reverse("cookbook:meal_plan"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["days"]), 7)
        self.assertEqual(response.context["days"][0]["date"], self.monday)

    def test_post_assigns_recipe_to_a_day(self):
        self.client.post(
            reverse("cookbook:meal_plan"),
            {"date": self.monday.isoformat(), "recipe": self.recipe.pk},
        )
        plan = MealPlan.objects.get(account=self.account, date=self.monday, meal_type="dinner")
        self.assertEqual(plan.recipe, self.recipe)

    def test_post_reassigns_existing_day(self):
        MealPlan.objects.create(account=self.account, date=self.monday, recipe=self.recipe, meal_type="dinner")
        other = Recipe.objects.create(account=self.account, title="Pasta", category="DINNER")
        self.client.post(
            reverse("cookbook:meal_plan"),
            {"date": self.monday.isoformat(), "recipe": other.pk},
        )
        plan = MealPlan.objects.get(account=self.account, date=self.monday, meal_type="dinner")
        self.assertEqual(plan.recipe, other)
        self.assertEqual(MealPlan.objects.filter(account=self.account, date=self.monday).count(), 1)

    def test_post_blank_recipe_unassigns_day(self):
        MealPlan.objects.create(account=self.account, date=self.monday, recipe=self.recipe, meal_type="dinner")
        self.client.post(reverse("cookbook:meal_plan"), {"date": self.monday.isoformat(), "recipe": ""})
        self.assertFalse(MealPlan.objects.filter(account=self.account, date=self.monday).exists())

    def test_post_date_outside_current_week_is_ignored(self):
        outside = self.monday - timedelta(days=14)
        self.client.post(
            reverse("cookbook:meal_plan"),
            {"date": outside.isoformat(), "recipe": self.recipe.pk},
        )
        self.assertFalse(MealPlan.objects.filter(date=outside).exists())

    def test_post_redirects_back_to_meal_plan(self):
        response = self.client.post(
            reverse("cookbook:meal_plan"),
            {"date": self.monday.isoformat(), "recipe": self.recipe.pk},
        )
        self.assertRedirects(response, reverse("cookbook:meal_plan"))
