import { expect } from '@playwright/test';
import { test } from '../fixtures/test';
import { getAnyConfiguredFamilyUser } from '../fixtures/authUsers';

const SKIP_REASON = 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.';

test.describe('Vacations', () => {
  // ── Navigation ────────────────────────────────────────────────────────────

  test('Vacations - Navigate via URL lands on Vacations view', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();
    await vacationsPage.expectVacationsHeading();
  });

  test('Vacations - Navigate via sidebar lands on Vacations view', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaSidebar();
    await vacationsPage.expectVacationsHeading();
  });

  // ── Vacation creation flow ────────────────────────────────────────────────

  test('Vacations - Create a new vacation and verify the card appears', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'trip destination',
      description: 'A memorable family getaway',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    // The new card should be visible in the list
    await expect(vacationsPage.vacationCard('trip destination')).toBeVisible();
  });

  // ── Tab interaction ───────────────────────────────────────────────────────

  test('Vacations - Itinerary tab shows the Add Leg button', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    // Create a dedicated vacation for this test
    await vacationsPage.createVacation({
      title: 'trip destination - itinerary',
      description: 'Testing itinerary tab',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    // Open the card with the Itinerary tab active
    await vacationsPage.openVacationDetail('trip destination - itinerary', 'Itinerary');

    // The "✅ Activities" / "🗺️ Itinerary" tab bar should now be visible.
    // Switch to (or confirm) the Itinerary tab and verify the "+ Add Leg" button.
    await vacationsPage.switchTab('Itinerary');
    await expect(vacationsPage.addLegBtn).toBeVisible();
  });

  test('Vacations - Excursions tab shows informational message when no legs exist', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    // Create a dedicated vacation for this test
    await vacationsPage.createVacation({
      title: 'trip destination - excursions',
      description: 'Testing excursions tab',
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    // Open the card with the Excursions tab active
    await vacationsPage.openVacationDetail('trip destination - excursions', 'Excursions');

    // Switch to the Excursions tab in the detail view
    await vacationsPage.switchTab('Excursions');

    // Without any itinerary legs, the conditional message should be shown
    await expect(vacationsPage.noLegsMessage).toBeVisible();
  });
});
