import { expect } from '@playwright/test';
import { test } from '../fixtures/test';
import { getAnyConfiguredFamilyUser } from '../fixtures/authUsers';
import { uniqueTestID } from '../utils/test-helpers';

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

    const title = uniqueTestID('trip destination');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      description: 'A memorable family getaway',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    // The new card should be visible in the list
    await expect(vacationsPage.vacationCard(title)).toBeVisible();
  });

  // ── Tab interaction ───────────────────────────────────────────────────────

  test('Vacations - Itinerary tab shows the Add Leg button', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const title = uniqueTestID('trip destination - itinerary');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    // Create a dedicated vacation for this test
    await vacationsPage.createVacation({
      title,
      description: 'Testing itinerary tab',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    // Open the card with the Itinerary tab active
    await vacationsPage.openVacationDetail(title, 'Itinerary');

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

    const title = uniqueTestID('trip destination - excursions');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    // Create a dedicated vacation for this test
    await vacationsPage.createVacation({
      title,
      description: 'Testing excursions tab',
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    // Open the card with the Excursions tab active
    await vacationsPage.openVacationDetail(title, 'Excursions');

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

    const title = uniqueTestID('bs vacation - date range');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await expect(vacationsPage.vacationCard(title)).toBeVisible();
  });

  test('Vacation - Add a flight segment with valid departure and arrival', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const title = uniqueTestID('bs vacation - flight segment');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      tripType: 'SINGLE_LOCATION',
      transportation: 'flight',
    });

    await vacationsPage.openVacationDetail(title, 'Flights');
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

    const title = uniqueTestID('bs vacation - blocked flight');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      tripType: 'SINGLE_LOCATION',
      transportation: 'flight',
    });

    await vacationsPage.openVacationDetail(title, 'Flights');
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

    const title = uniqueTestID('bs vacation - activities');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail(title, 'Activities');
    await vacationsPage.addActivity({
      name: 'Sightseeing tour',
      date: '2026-07-02',
    });

    await expect(vacationsPage.page.locator('h5', { hasText: 'Sightseeing tour' })).toBeVisible();
  });

  test('Vacation - Voting up on an excursion increments the upvote', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const title = uniqueTestID('bs vacation - upvote');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail(title, 'Itinerary');
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

    const title = uniqueTestID('bs vacation - activity feedback');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      tripType: 'SINGLE_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail(title, 'Activities');
    await vacationsPage.addActivity({
      name: 'City walk',
      date: '2026-07-02',
    });
    await vacationsPage.openActivityFeedback('City walk');
    await vacationsPage.submitActivityFeedback(4, 'Really enjoyable experience!');

    await expect(vacationsPage.page.getByText('Really enjoyable experience!')).toBeVisible();
  });

  test('Vacation - Add an excursion option with a status', async ({
    vacationsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const title = uniqueTestID('bs vacation - excursion status');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail(title, 'Itinerary');
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

    const title = uniqueTestID('bs vacation - excursion comment');

    await loginAs();
    await vacationsPage.gotoViaUrl();

    await vacationsPage.createVacation({
      title,
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      tripType: 'MULTI_LOCATION',
      transportation: 'car',
    });

    await vacationsPage.openVacationDetail(title, 'Itinerary');
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
