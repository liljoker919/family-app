import { expect } from '@playwright/test';
import { test } from '../fixtures/test';
import { getAnyConfiguredFamilyUser } from '../fixtures/authUsers';

const SKIP_REASON = 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.';

test.describe('Cars', () => {
  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Cars - Add a car with all required fields', async ({ carsPage, loginAs }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await carsPage.goto();

    await carsPage.createCar({
      make: 'Toyota',
      model: 'Camry',
      year: '2022',
      vin: '1HGBH41JXMN109186',
    });

    // The new car card should appear in the list with the correct make, model, and year
    await expect(carsPage.getCarCard('2022', 'Toyota', 'Camry')).toBeVisible();
  });

  test('Cars - Add car form is blocked when a required field is missing', async ({
    carsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await carsPage.goto();

    // Open the Add Car form
    await carsPage.addCarBtn.click();

    // Leave Make empty; fill all other required fields
    await carsPage.modelInput.fill('Civic');
    await carsPage.yearInput.fill('2021');
    await carsPage.vinInput.fill('2T1BURHE0JC034321');

    // Attempt to submit – HTML5 validation should block the submission
    await carsPage.createCarBtn.click();

    // The modal must remain open because the Make field is required
    await expect(carsPage.addCarModalHeading).toBeVisible();
  });

  test('Cars - Deleting a car removes it from the list', async ({ carsPage, loginAs }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await carsPage.goto();

    // Create a car so there is at least one car to delete
    await carsPage.createCar({
      make: 'Ford',
      model: 'Focus',
      year: '2019',
      vin: '1FADP3F20EL123456',
    });

    await expect(carsPage.getCarCard('2019', 'Ford', 'Focus')).toBeVisible();

    // Delete the car and confirm the browser dialog
    await carsPage.deleteCar('2019', 'Ford', 'Focus');

    // The car should no longer appear in the list
    await expect(carsPage.getCarCard('2019', 'Ford', 'Focus')).not.toBeVisible();
  });

  test('Cars - Update current mileage for a car', async ({ carsPage, loginAs }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await carsPage.goto();

    // Create a car with an initial mileage value
    await carsPage.createCar({
      make: 'Honda',
      model: 'Accord',
      year: '2020',
      vin: '1HGCV1F34LA012345',
      currentMileage: '10000',
    });

    await expect(carsPage.getCarCard('2020', 'Honda', 'Accord')).toBeVisible();

    // Perform the inline mileage update
    await carsPage.startMileageUpdate('2020', 'Honda', 'Accord');
    await carsPage.saveMileageUpdate('2020', 'Honda', 'Accord', '15000');

    // The displayed mileage should update and be formatted with comma separators
    const card = carsPage.getCarCard('2020', 'Honda', 'Accord');
    await expect(card.getByText('15,000 miles')).toBeVisible();
  });

  test('Car - Car expiring within 30 days shows a warning badge', async ({
    carsPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await carsPage.goto();

    // Build a registration expiry date that falls 15 days from today
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 15);
    const expiryStr = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

    await carsPage.createCar({
      make: 'Chevrolet',
      model: 'Malibu',
      year: '2021',
      vin: '1G1ZD5ST3JF123456',
      registrationExpiry: expiryStr,
    });

    const card = carsPage.getCarCard('2021', 'Chevrolet', 'Malibu');
    await expect(card).toBeVisible();

    // A yellow "Expiring Soon" warning badge should appear next to the registration date
    await expect(card.getByText(/⚠️ Expiring Soon/)).toBeVisible();
  });
});
