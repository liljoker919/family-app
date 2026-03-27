import { expect } from '@playwright/test';
import { test } from '../fixtures/test';
import type { CarDetails, ServiceDetails } from '../pages/CarsPage';

type CreatedCar = Pick<CarDetails, 'year' | 'make' | 'model' | 'vin'>;

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function buildUniqueCar(base: Pick<CarDetails, 'make' | 'model' | 'year'>): CreatedCar {
  const suffix = uniqueSuffix();
  const model = `${base.model}-${suffix}`;
  const vin = `E2E${suffix}`.slice(0, 17).toUpperCase();
  return {
    make: base.make,
    model,
    year: base.year,
    vin,
  };
}

test.describe('Cars', () => {
  let createdCars: CreatedCar[] = [];

  test.beforeEach(() => {
    createdCars = [];
  });

  test.afterEach(async ({ carsPage, loginAs }) => {
    if (createdCars.length === 0) {
      return;
    }

    try {
      await loginAs();
      await carsPage.goto();
      for (const car of createdCars) {
        const card = carsPage.getCarCardByVin(car.vin);
        if (await card.isVisible().catch(() => false)) {
          await carsPage.deleteCarByVin(car.vin).catch(() => undefined);
        }
      }
    } catch {
      // Best-effort cleanup only; do not mask test results.
    }
  });

  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Cars - Add a car with all required fields', async ({ carsPage, loginAs }) => {
    await loginAs();
    // Successful sign-in lands on the dashboard; switch modules from there.
    await carsPage.goto();

    const car = buildUniqueCar({
      make: 'Toyota',
      model: 'Camry',
      year: '2022',
    });
    createdCars.push(car);

    await carsPage.createCar(car);

    // The new car card should appear in the list with the correct make, model, and year
    await expect(carsPage.getCarCardByVin(car.vin)).toBeVisible();
  });

  test('Cars - Add car form is blocked when a required field is missing', async ({
    carsPage,
    loginAs,
  }) => {
    await loginAs();
    // Successful sign-in lands on the dashboard; switch modules from there.
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
    await loginAs();
    // Successful sign-in lands on the dashboard; switch modules from there.
    await carsPage.goto();

    const car = buildUniqueCar({
      make: 'Ford',
      model: 'Focus',
      year: '2019',
    });

    // Create a car so there is at least one car to delete
    await carsPage.createCar(car);

    await expect(carsPage.getCarCardByVin(car.vin)).toBeVisible();

    // Delete the car and confirm the browser dialog
    await carsPage.deleteCarByVin(car.vin);

    // The car should no longer appear in the list
    await expect(carsPage.getCarCardByVin(car.vin)).not.toBeVisible();
  });

  test('Cars - Update current mileage for a car', async ({ carsPage, loginAs }) => {
    await loginAs();
    // Successful sign-in lands on the dashboard; switch modules from there.
    await carsPage.goto();

    const car = buildUniqueCar({
      make: 'Honda',
      model: 'Accord',
      year: '2020',
    });
    createdCars.push(car);

    // Create a car with an initial mileage value
    await carsPage.createCar({
      ...car,
      currentMileage: '10000',
    });

    await expect(carsPage.getCarCardByVin(car.vin)).toBeVisible();

    // Perform the inline mileage update
    await carsPage.startMileageUpdate(car.year, car.make, car.model);
    await carsPage.saveMileageUpdate(car.year, car.make, car.model, '15000');

    // The displayed mileage should update and be formatted with comma separators
    const card = carsPage.getCarCardByVin(car.vin);
    await expect(card.getByText('15,000 miles')).toBeVisible();
  });

  test('Car - Car expiring within 30 days shows a warning badge', async ({
    carsPage,
    loginAs,
  }) => {
    await loginAs();
    // Successful sign-in lands on the dashboard; switch modules from there.
    await carsPage.goto();

    // Build a registration expiry date that falls 15 days from today
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 15);
    const expiryStr = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

    const car = buildUniqueCar({
      make: 'Chevrolet',
      model: 'Malibu',
      year: '2021',
    });
    createdCars.push(car);

    await carsPage.createCar({
      ...car,
      registrationExpiry: expiryStr,
    });

    const card = carsPage.getCarCardByVin(car.vin);
    await expect(card).toBeVisible();

    // A yellow "Expiring Soon" warning badge should appear next to the registration date
    await expect(card.getByText(/⚠️ Expiring Soon/)).toBeVisible();
  });

  test('Cars - Car with a past registration expiry shows an expired badge', async ({
    carsPage,
    loginAs,
  }) => {
    await loginAs();
    await carsPage.goto();

    // Build a registration expiry date 15 days in the past
    const expiry = new Date();
    expiry.setDate(expiry.getDate() - 15);
    const expiryStr = expiry.toISOString().split('T')[0]; // YYYY-MM-DD

    const car = buildUniqueCar({
      make: 'Nissan',
      model: 'Altima',
      year: '2018',
    });
    createdCars.push(car);

    await carsPage.createCar({
      ...car,
      registrationExpiry: expiryStr,
    });

    const card = carsPage.getCarCardByVin(car.vin);
    await expect(card).toBeVisible();

    // A red "Expired" badge should appear next to the registration date
    await expect(card.getByText(/⚠️ Expired/)).toBeVisible();
  });

  test('Cars - Add a service record to a car', async ({ carsPage, loginAs }) => {
    await loginAs();
    await carsPage.goto();

    const car = buildUniqueCar({
      make: 'Subaru',
      model: 'Outback',
      year: '2021',
    });
    createdCars.push(car);

    await carsPage.createCar(car);
    await expect(carsPage.getCarCardByVin(car.vin)).toBeVisible();

    // Open service history and add a service record
    await carsPage.viewServiceHistory(car.vin);
    const serviceDetails: ServiceDetails = {
      serviceType: 'Oil Change',
      date: '2026-03-01',
      cost: '45.99',
      provider: 'Jiffy Lube',
    };
    await carsPage.addServiceRecord(serviceDetails);

    // The service record should appear in the service history list
    await expect(carsPage.getServiceRecord('Oil Change')).toBeVisible();
  });
});
