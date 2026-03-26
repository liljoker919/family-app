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

  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Vacation - Add a vacation with a title and date range', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - date range',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await expect(vacationsPage.vacationCard('bs vacation - date range')).toBeVisible();
  });

  test('Vacation - Add a flight segment with valid departure and arrival', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - flight segment',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      tripType: 'SINGLE_LOCATION',
      transportation: 'flight',
    });

    await vacationsPage.openVacationDetail('bs vacation - flight segment', 'Flights');
    await vacationsPage.addFlightSegment({
      airline: 'Test Air',
      flightNumber: 'TA101',
      departureAirport: 'JFK',
      arrivalAirport: 'LAX',
      departureDateTime: '2026-08-01T08:00',
      arrivalDateTime: '2026-08-01T11:00',
    });

    await expect(vacationsPage.flightSegmentCard('Test Air', 'TA101')).toBeVisible();
  });

  test('Vacation - Flight segment with arrival before departure is blocked', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - blocked flight',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      tripType: 'SINGLE_LOCATION',
      transportation: 'flight',
    });

    await vacationsPage.openVacationDetail('bs vacation - blocked flight', 'Flights');
    // Arrival (08:00) is before departure (11:00) — validation must block saving
    await vacationsPage.addFlightSegment({
      airline: 'Test Air',
      flightNumber: 'TA202',
      departureAirport: 'JFK',
      arrivalAirport: 'LAX',
      departureDateTime: '2026-09-01T11:00',
      arrivalDateTime: '2026-09-01T08:00',
    });

    await expect(vacationsPage.flightSegmentFormError).toBeVisible();
  });

  test('Vacation - Add an activity to a vacation', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - activities',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail('bs vacation - activities', 'Activities');
    await vacationsPage.addActivity({ name: 'Sightseeing tour' });

    await expect(vacationsPage.page.locator('h5', { hasText: 'Sightseeing tour' })).toBeVisible();
  });

  test('Vacation - Voting up on an excursion increments the upvote', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - upvote',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail('bs vacation - upvote', 'Itinerary');
    await vacationsPage.switchTab('Itinerary');
    await vacationsPage.addLeg({ name: 'Beach Stay', startDate: '2026-07-01', endDate: '2026-07-07' });
    await expect(vacationsPage.page.getByText('Beach Stay')).toBeVisible();

    await vacationsPage.switchTab('Excursions');
    await vacationsPage.selectLegInExcursions('Beach Stay');
    await vacationsPage.proposeExcursion({ name: 'Boat Tour', status: 'PROPOSED' });

    const excCard = vacationsPage.excursionCard('Boat Tour');
    await expect(excCard.getByRole('button', { name: /👍/ })).toContainText('0');

    await vacationsPage.voteUpOnExcursion('Boat Tour');

    await expect(excCard.getByRole('button', { name: /👍/ })).toContainText('1');
  });

  test('Vacation - Add a rating and comment to an activity', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - activity feedback',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail('bs vacation - activity feedback', 'Activities');
    await vacationsPage.addActivity({ name: 'City walk' });
    await vacationsPage.openActivityFeedback('City walk');
    await vacationsPage.submitActivityFeedback(4, 'Really enjoyable experience!');

    await expect(vacationsPage.page.getByText('Really enjoyable experience!')).toBeVisible();
  });

  test('Vacation - Add an excursion option with a status', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - excursion status',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail('bs vacation - excursion status', 'Itinerary');
    await vacationsPage.switchTab('Itinerary');
    await vacationsPage.addLeg({ name: 'Mountain Trek', startDate: '2026-07-01', endDate: '2026-07-07' });
    await expect(vacationsPage.page.getByText('Mountain Trek')).toBeVisible();

    await vacationsPage.switchTab('Excursions');
    await vacationsPage.selectLegInExcursions('Mountain Trek');
    await vacationsPage.proposeExcursion({ name: 'Zip Line', status: 'UNDER_REVIEW' });

    await expect(vacationsPage.excursionCard('Zip Line').getByText('UNDER_REVIEW')).toBeVisible();
  });

  test('Vacation - Add a comment to an excursion', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title: 'bs vacation - excursion comment',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail('bs vacation - excursion comment', 'Itinerary');
    await vacationsPage.switchTab('Itinerary');
    await vacationsPage.addLeg({ name: 'City Tour', startDate: '2026-07-01', endDate: '2026-07-07' });
    await expect(vacationsPage.page.getByText('City Tour')).toBeVisible();

    await vacationsPage.switchTab('Excursions');
    await vacationsPage.selectLegInExcursions('City Tour');
    await vacationsPage.proposeExcursion({ name: 'Museum Visit', status: 'PROPOSED' });

    await vacationsPage.openExcursionComments('Museum Visit');
    await vacationsPage.postExcursionComment('This looks amazing!');

    await expect(vacationsPage.page.getByText('This looks amazing!')).toBeVisible();
  });
});
