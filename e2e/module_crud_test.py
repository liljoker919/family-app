"""#374 — one add -> edit -> delete pass per Family-tier-gated module, plus
the Free-tier tasks/shopping modules and the cookbook->shopping integration.

Django TestCases already cover create/update/delete at the view/form level
for every module; none of that exercises real browser rendering, so a
broken template, a hidden submit button, or a broken redirect wouldn't be
caught. Each test here asserts the change is actually visible in the
rendered page after the action, not just a redirect/200 status code.

Every test uses a fresh Family-tier account (make_authenticated_page) —
Family tier includes everything in Free, so it reaches every module here
without hitting the upgrade wall (#308).
"""

import datetime

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def _submit(page):
    # Scoped to <main> — the sidebar's own "Sign out" button is also
    # type=submit and present on every page.
    page.locator("main button[type=submit]").click()


def test_vehicle_add_edit_delete(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="family")

    page.goto(f"{live_server.url}/vehicles/add/")
    page.fill("#id_year", "2022")
    page.fill("#id_make", "Toyota")
    page.fill("#id_model", "Camry")
    page.fill("#id_color", "Silver")
    page.fill("#id_license_plate", "ABC-1234")
    page.fill("#id_vin", "1HGCM82633A004352")
    page.fill("#id_current_mileage", "15000")
    page.fill("#id_registration_expiry", "2027-01-01")
    _submit(page)

    # Create redirects to the list, not the new detail page.
    page.wait_for_url(f"{live_server.url}/vehicles/")
    expect(page.get_by_text("2022 Toyota Camry")).to_be_visible()

    page.get_by_role("link", name="View Details").click()
    page.wait_for_url("**/vehicles/*/")

    page.get_by_role("link", name="Edit Vehicle").click()
    page.fill("#id_model", "Corolla")
    _submit(page)
    page.wait_for_url("**/vehicles/*/")
    expect(page.get_by_text("2022 Toyota Corolla")).to_be_visible()

    # Add a service record while we're on the detail page. service_type has
    # no model default, so Django's form adds a blank "---------" choice —
    # pick a real one explicitly or the required field submits empty.
    page.get_by_role("link", name="Add Service Record").click()
    page.locator("#id_service_type").select_option("oil_change")
    page.fill("#id_date", "2026-01-15")
    page.fill("#id_mileage_at_service", "15000")
    page.fill("#id_provider", "Jiffy Lube")
    _submit(page)
    page.wait_for_url("**/vehicles/*/")
    expect(page.get_by_text("Jiffy Lube")).to_be_visible()

    # Both the vehicle itself and its (now one) service record have their
    # own "Delete" link — the vehicle's is the header action, first in the DOM.
    page.get_by_role("link", name="Delete").first.click()
    page.get_by_role("button", name="Delete Vehicle").click()
    page.wait_for_url(f"{live_server.url}/vehicles/")
    expect(page.get_by_text("2022 Toyota Corolla")).not_to_be_visible()


def test_property_add_maintenance_project_complete_delete(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="family")

    page.goto(f"{live_server.url}/property/add/")
    page.fill("#id_name", "Main Street Rental")
    page.fill("#id_address", "123 Main St")
    _submit(page)

    # Create redirects to the list, not the new detail page.
    page.wait_for_url(f"{live_server.url}/property/")
    expect(page.get_by_text("Main Street Rental")).to_be_visible()

    page.get_by_role("link", name="View Maintenance").click()
    page.wait_for_url("**/property/*/")
    property_url = page.url

    page.get_by_role("link", name="Add Project").click()
    page.fill("#id_title", "Replace HVAC filter")
    _submit(page)
    page.wait_for_url(property_url)
    expect(page.get_by_text("Replace HVAC filter")).to_be_visible()

    page.get_by_role("link", name="Edit", exact=True).click()
    page.locator("#id_status").select_option("completed")
    _submit(page)
    page.wait_for_url(property_url)

    # Completed projects move into a collapsed "Completed (N)" <details>
    # section instead of the open-projects list — expand it to confirm the
    # project is still there, not just gone from the page.
    page.get_by_text("Completed (1)").click()
    expect(page.get_by_text("Replace HVAC filter")).to_be_visible()

    page.get_by_role("link", name="Delete", exact=True).click()
    page.get_by_role("button", name="Delete Property").click()
    page.wait_for_url(f"{live_server.url}/property/")
    expect(page.get_by_text("Main Street Rental")).not_to_be_visible()


def test_task_create_change_status_delete(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="free")

    page.goto(f"{live_server.url}/tasks/new/")
    page.fill("#id_title", "Clean the garage")
    _submit(page)

    page.wait_for_url(f"{live_server.url}/tasks/")
    expect(page.get_by_text("Clean the garage")).to_be_visible()

    # Stay on the board: its status-change buttons are HTMX-swapped in
    # place (tasks/partials/task_card.html), unlike the plain-POST ones on
    # the task detail page, which redirect back to the board on submit.
    page.get_by_role("button", name="→ Start").click()
    expect(page.get_by_role("button", name="✓ Done")).to_be_visible()

    page.get_by_role("link", name="Del", exact=True).click()
    page.get_by_role("button", name="Yes, delete").click()
    page.wait_for_url(f"{live_server.url}/tasks/")
    expect(page.get_by_text("Clean the garage")).not_to_be_visible()


def test_shopping_item_add_delete_and_recipe_ingredients_integration(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="free")

    page.goto(f"{live_server.url}/shopping/add/")
    page.fill("#id_name", "Chicken breast")
    page.fill("#id_quantity", "2")
    _submit(page)

    page.wait_for_url(f"{live_server.url}/shopping/")
    # "Chicken breast" alone also matches the "Added ... to your list" flash
    # message — match the actual list-row text ("<qty> <name>") instead.
    expect(page.get_by_text("2 Chicken breast")).to_be_visible()

    page.get_by_role("link", name="Del", exact=True).click()
    page.get_by_role("button", name="Remove").click()
    page.wait_for_url(f"{live_server.url}/shopping/")
    expect(page.get_by_text("2 Chicken breast")).not_to_be_visible()

    # Recipe -> shopping list integration: adding a recipe's ingredients
    # needs a Family-tier account to reach the cookbook module (#308), so
    # this half of the test runs as its own logged-in account.
    page2, _user2, _account2 = make_authenticated_page(tier="family", username="e2e_user2")

    page2.goto(f"{live_server.url}/cookbook/add/")
    page2.fill("#id_title", "Grandma's Lasagna")
    _submit(page2)
    page2.wait_for_url("**/cookbook/*/")
    recipe_url = page2.url

    page2.get_by_role("link", name="+ Add").first.click()
    page2.fill("#id_name", "All-purpose flour")
    page2.fill("#id_quantity", "2")
    _submit(page2)
    page2.wait_for_url(recipe_url)
    expect(page2.get_by_text("All-purpose flour")).to_be_visible()

    # Adding a recipe's ingredients redirects back to the recipe itself
    # (with a flash message), not to the shopping list — check the list
    # separately.
    page2.get_by_role("button", name="Add to Shopping List").click()
    page2.wait_for_url(recipe_url)
    page2.goto(f"{live_server.url}/shopping/")
    expect(page2.get_by_text("All-purpose flour")).to_be_visible()


def test_cookbook_recipe_add_ingredient_step_edit_delete(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="family")

    page.goto(f"{live_server.url}/cookbook/add/")
    page.fill("#id_title", "Weeknight Tacos")
    _submit(page)
    page.wait_for_url("**/cookbook/*/")
    recipe_url = page.url

    # Ingredients section's "+ Add" comes before Steps' in the DOM.
    page.get_by_role("link", name="+ Add").first.click()
    page.fill("#id_name", "Ground beef")
    page.fill("#id_quantity", "1")
    _submit(page)
    page.wait_for_url(recipe_url)
    expect(page.get_by_text("Ground beef")).to_be_visible()

    page.get_by_role("link", name="+ Add").last.click()
    page.fill("#id_step_number", "1")
    page.fill("#id_instruction", "Brown the beef.")
    _submit(page)
    page.wait_for_url(recipe_url)
    expect(page.get_by_text("Brown the beef.")).to_be_visible()

    page.get_by_role("link", name="Edit Recipe").click()
    page.fill("#id_title", "Weeknight Beef Tacos")
    _submit(page)
    page.wait_for_url(recipe_url)
    expect(page.get_by_text("Weeknight Beef Tacos")).to_be_visible()

    # The recipe's own "Delete" (header action) and the step's "Delete" both
    # match — the header one is first in the DOM.
    page.get_by_role("link", name="Delete", exact=True).first.click()
    page.get_by_role("button", name="Yes, delete").click()
    page.wait_for_url(f"{live_server.url}/cookbook/")
    expect(page.get_by_text("Weeknight Beef Tacos")).not_to_be_visible()


def test_vacation_add_expense_reservation_delete(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="family")

    page.goto(f"{live_server.url}/vacations/new/")
    page.fill("#id_name", "Summer Beach Trip 2026")
    page.fill("#id_destination", "Outer Banks, NC")
    page.fill("#id_start_date", "2026-07-01")
    page.fill("#id_end_date", "2026-07-08")
    _submit(page)

    # Create redirects to the list, not the new detail page.
    page.wait_for_url(f"{live_server.url}/vacations/")
    expect(page.get_by_text("Summer Beach Trip 2026")).to_be_visible()

    page.get_by_role("link", name="View Trip →").click()
    page.wait_for_url("**/vacations/*/")
    vacation_url = page.url

    # category/type have no model default (unlike vehicles.service_type,
    # every other choice field seen in this suite does), so the form adds a
    # blank "---------" choice — pick a real one or the required field
    # submits empty.
    page.get_by_role("button", name="Expenses").click()
    page.get_by_role("link", name="+ Add Expense").click()
    page.locator("#id_category").select_option("HOTEL")
    page.fill("#id_date", "2026-07-02")
    page.fill("#id_description", "Hotel night 1")
    page.fill("#id_amount", "150.00")
    page.fill("#id_paid_by", "Mom")
    _submit(page)
    # Expense/reservation creates redirect straight to the right tab.
    page.wait_for_url(f"{vacation_url}?tab=expenses")
    expect(page.get_by_text("Hotel night 1")).to_be_visible()

    page.get_by_role("button", name="Reservations").click()
    page.get_by_role("link", name="+ Add Reservation").click()
    page.locator("#id_type").select_option("HOTEL")
    page.fill("#id_provider", "Delta")
    page.fill("#id_confirmation_number", "ABC123")
    page.fill("#id_departure_time", "2026-07-01T15:00")
    page.fill("#id_arrival_time", "2026-07-01T18:00")
    _submit(page)
    page.wait_for_url(f"{vacation_url}?tab=reservations")
    expect(page.get_by_text("Delta")).to_be_visible()

    # The trip's own "Delete" (header action) is first in the DOM, ahead of
    # the expense/reservation rows' own "Delete" links.
    page.get_by_role("link", name="Delete", exact=True).first.click()
    page.get_by_role("button", name="Yes, Delete Trip").click()
    page.wait_for_url(f"{live_server.url}/vacations/")
    expect(page.get_by_text("Summer Beach Trip 2026")).not_to_be_visible()


def test_calendar_add_event_appears_on_calendar_delete(live_server, make_authenticated_page):
    page, _user, _account = make_authenticated_page(tier="family")

    title = "Family Game Night"
    today = datetime.date.today()
    start = f"{today.isoformat()}T18:00"
    end = f"{today.isoformat()}T20:00"

    page.goto(f"{live_server.url}/calendar/event/add/")
    page.fill("#id_title", title)
    page.fill("#id_start", start)
    page.fill("#id_end", end)
    _submit(page)

    page.wait_for_url(f"{live_server.url}/calendar/")
    expect(page.locator(".fc-event-title", has_text=title)).to_be_visible()

    page.locator(".fc-event-title", has_text=title).click()
    page.get_by_role("link", name="Delete").click()
    page.get_by_role("button", name="Delete Event").click()
    page.wait_for_url(f"{live_server.url}/calendar/")
    expect(page.locator(".fc-event-title", has_text=title)).not_to_be_visible()
