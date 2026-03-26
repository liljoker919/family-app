import { expect, type Locator, type Page } from '@playwright/test';

export interface CarDetails {
  make: string;
  model: string;
  year: string;
  vin: string;
  color?: string;
  licensePlate?: string;
  registrationExpiry?: string;
  currentMileage?: string;
}

export class CarsPage {
  readonly page: Page;

  // ── Navigation ───────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly sidebarLink: Locator;

  // ── Main action ──────────────────────────────────────────────────────────
  readonly addCarBtn: Locator;

  // ── Car form modal fields ────────────────────────────────────────────────
  readonly makeInput: Locator;
  readonly modelInput: Locator;
  readonly yearInput: Locator;
  readonly vinInput: Locator;
  readonly colorInput: Locator;
  readonly licensePlateInput: Locator;
  readonly registrationExpiryInput: Locator;
  readonly currentMileageInput: Locator;
  readonly createCarBtn: Locator;

  // ── Modal heading (used to assert the modal is still open) ───────────────
  readonly addCarModalHeading: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.heading = page.getByRole('heading', { name: 'Cars Management' });
    this.sidebarLink = page.getByRole('button', { name: /^Cars$/ });

    // "Add Car" primary button (outside any modal)
    this.addCarBtn = page.getByRole('button', { name: 'Add Car' });

    // Form modal – labels are adjacent siblings of their inputs inside the
    // same div.  Scope to the form that contains the "Create Car" submit
    // button so these locators stay unique even when the service form is open.
    const modal = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Create Car' }) });
    this.makeInput = modal.locator('label:has-text("Make") + input');
    this.modelInput = modal.locator('label:has-text("Model") + input');
    this.yearInput = modal.locator('label:has-text("Year") + input');
    this.vinInput = modal.locator('label:has-text("VIN") + input');
    this.colorInput = modal.locator('label:has-text("Color") + input');
    this.licensePlateInput = modal.locator('label:has-text("License Plate") + input');
    this.registrationExpiryInput = modal.locator('label:has-text("Registration Expiry") + input');
    this.currentMileageInput = modal.locator('label:has-text("Current Mileage") + input');
    this.createCarBtn = page.getByRole('button', { name: 'Create Car' });

    // Modal heading – visible only while the "Add Car" modal is open
    this.addCarModalHeading = page.getByRole('heading', { name: 'Add New Car' });
  }

  // ── Navigation methods ───────────────────────────────────────────────────

  /**
   * Navigate to the dashboard and activate the Cars module by clicking its
   * link in the left sidebar navigation.
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.sidebarLink.click();
    await expect(this.heading).toBeVisible();
  }

  // ── Locator helpers ──────────────────────────────────────────────────────

  /**
   * Returns a locator for the car card identified by year, make and model
   * (displayed as the card's h3 heading: "{year} {make} {model}").
   */
  getCarCard(year: string, make: string, model: string): Locator {
    return this.page
      .locator('div.bg-white.rounded-lg.shadow-md')
      .filter({ has: this.page.getByRole('heading', { name: `${year} ${make} ${model}`, level: 3 }) });
  }

  // ── Action methods ───────────────────────────────────────────────────────

  /**
   * Opens the Add Car modal, fills all provided fields, and submits the form.
   */
  async createCar(details: CarDetails): Promise<void> {
    await this.addCarBtn.click();
    await this.makeInput.fill(details.make);
    await this.modelInput.fill(details.model);
    await this.yearInput.fill(details.year);
    await this.vinInput.fill(details.vin);
    if (details.color) {
      await this.colorInput.fill(details.color);
    }
    if (details.licensePlate) {
      await this.licensePlateInput.fill(details.licensePlate);
    }
    if (details.registrationExpiry) {
      await this.registrationExpiryInput.fill(details.registrationExpiry);
    }
    if (details.currentMileage) {
      await this.currentMileageInput.fill(details.currentMileage);
    }
    await this.createCarBtn.click();
  }

  /**
   * Deletes the car identified by year, make and model.
   * Automatically accepts the browser confirmation dialog.
   */
  async deleteCar(year: string, make: string, model: string): Promise<void> {
    const card = this.getCarCard(year, make, model);
    this.page.once('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', { name: 'Delete' }).click();
  }

  /**
   * Clicks the "Update" link on the given car card to begin an inline
   * mileage edit.
   */
  async startMileageUpdate(year: string, make: string, model: string): Promise<void> {
    const card = this.getCarCard(year, make, model);
    await card.getByRole('button', { name: 'Update' }).click();
  }

  /**
   * Fills in the new mileage value and clicks "Save" to complete the inline
   * mileage edit.  Assumes `startMileageUpdate` has already been called.
   */
  async saveMileageUpdate(year: string, make: string, model: string, newMileage: string): Promise<void> {
    const card = this.getCarCard(year, make, model);
    await card.getByPlaceholder('New mileage').fill(newMileage);
    await card.getByRole('button', { name: 'Save' }).click();
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  /** Assert that the Cars Management module heading is visible. */
  async expectCarsHeading(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }
}
