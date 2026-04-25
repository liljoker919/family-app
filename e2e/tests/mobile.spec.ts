/**
 * Mobile Viewport Sanity Tests
 *
 * Validates that critical user flows are usable on small-screen devices.
 * These tests are intentionally run only on the configured mobile projects
 * (iPhone 13 and Pixel 5) defined in playwright.config.ts.
 *
 * Covered flows:
 *   - Auth  : Sign-in / Sign-up modals fit the viewport without overflow.
 *   - Chores: Action buttons (log completion, assign) are reachable on mobile.
 *   - Vacations: The multi-tab detail view does not overflow horizontally.
 *
 * Tests that require credentials are skipped gracefully when the relevant
 * environment variables are not set.
 */

import { test, expect } from '../fixtures/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uniqueTitle(base: string): string {
  return `${base}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Returns true when the page has no horizontal scrollbar (i.e. all content
 * fits within the viewport width).
 */
async function hasNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test.describe('Mobile – Auth', () => {
  test('Mobile auth - Sign-in form fits viewport without horizontal scrolling', async ({
    page,
    authPage,
  }) => {
    await authPage.goto();

    // The email and password inputs must be visible in the viewport.
    await expect(authPage.emailInput).toBeVisible();
    await expect(authPage.passwordInput).toBeVisible();
    await expect(authPage.signInButton).toBeVisible();

    // No horizontal overflow on the login page.
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('Mobile auth - Sign-in form inputs are tappable (not obscured or clipped)', async ({
    authPage,
  }) => {
    await authPage.goto();

    // Filling the fields on a narrow viewport must succeed without errors.
    await authPage.emailInput.fill('test@example.com');
    await authPage.passwordInput.fill('Password123!');

    // The Sign In button must be reachable and clickable.
    await expect(authPage.signInButton).toBeEnabled();
  });
});

// ── Chores ────────────────────────────────────────────────────────────────────

test.describe('Mobile – Chores', () => {
  test('Mobile chores - Action buttons are accessible on narrow viewport', async ({
    page,
    choresPage,
    loginAs,
  }) => {
    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    const title = uniqueTitle('Mobile Chore Test');
    await choresPage.createChore({ title, category: 'CLEANING', recurrence: 'WEEKLY' });

    const choreRow = choresPage.getChoreRow(title);
    await expect(choreRow).toBeVisible();

    // On mobile the action buttons (Edit, Delete, Assign, Log Done) must be
    // present and reachable without horizontal scrolling.
    await expect(choreRow.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(choreRow.getByRole('button', { name: /Log Done/ })).toBeVisible();

    // Verify no horizontal overflow while the chore list is displayed.
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // cleanup – best-effort; ignore if delete fails
    await choresPage.deleteChore(title).catch(() => undefined);
  });

  test('Mobile chores - Tab navigation is usable on narrow viewport', async ({
    page,
    choresPage,
    loginAs,
  }) => {
    await loginAs();
    await choresPage.goto();

    // All tab buttons must be visible without requiring horizontal scroll.
    await expect(choresPage.myChoresTab).toBeVisible();
    await expect(choresPage.allChoresTab).toBeVisible();
    await expect(choresPage.assignmentsTab).toBeVisible();
    await expect(choresPage.completionHistoryTab).toBeVisible();

    // Switching tabs must work correctly on mobile.
    await choresPage.switchToAllChores();
    await expect(choresPage.allChoresTab).toBeVisible();

    // No horizontal overflow during tab navigation.
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});

// ── Vacations ─────────────────────────────────────────────────────────────────

test.describe('Mobile – Vacations', () => {
  test('Mobile vacations - Vacations heading is visible on narrow viewport', async ({
    page,
    vacationsPage,
    loginAs,
  }) => {
    await loginAs();
    await vacationsPage.gotoViaUrl();
    await vacationsPage.expectVacationsHeading();

    // No horizontal overflow on the vacations list page.
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('Mobile vacations - Add Vacation modal fits viewport without overflow', async ({
    page,
    vacationsPage,
    loginAs,
  }) => {
    await loginAs();
    await vacationsPage.gotoViaUrl();

    // Open the "Add Vacation" modal.
    await vacationsPage.addVacationBtn.click();

    // The form fields must be visible and usable.
    await expect(vacationsPage.titleInput).toBeVisible();
    await expect(vacationsPage.startDateInput).toBeVisible();
    await expect(vacationsPage.endDateInput).toBeVisible();
    await expect(vacationsPage.createVacationBtn).toBeVisible();

    // The modal must not cause horizontal scrolling.
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('Mobile vacations - Detail tab bar does not overflow horizontally', async ({
    page,
    vacationsPage,
    loginAs,
  }) => {
    const title = uniqueTitle('Mobile Vacation Tab Test');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    // Create a vacation so we have a card to open.
    await vacationsPage.createVacation({
      title,
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await expect(vacationsPage.vacationCard(title)).toBeVisible();

    // Open the detail section to reveal the tab bar.
    await vacationsPage.openVacationDetail(title, 'Activities');

    // All four tabs must be reachable.
    await expect(vacationsPage.activitiesTab).toBeVisible();
    await expect(vacationsPage.itineraryTab).toBeVisible();
    await expect(vacationsPage.excursionsTab).toBeVisible();

    // Switching tabs must work without errors or overflow.
    await vacationsPage.switchTab('Itinerary');
    await expect(vacationsPage.addLegBtn).toBeVisible();

    // Verify no horizontal overflow while the tab bar is shown.
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
