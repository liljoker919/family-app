import { expect, type Locator, type Page } from '@playwright/test';

export interface VacationDetails {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  tripType?: 'SINGLE_LOCATION' | 'MULTI_LOCATION' | 'CRUISE';
  transportation?: 'flight' | 'car' | 'boat';
  accommodations?: string;
}

export interface ActivityDetails {
  name: string;
  description?: string;
  date?: string;
  location?: string;
}

export type VacationTab = 'Activities' | 'Itinerary' | 'Excursions' | 'Flights';

export class VacationsPage {
  readonly page: Page;

  // ── Navigation ───────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly sidebarLink: Locator;

  // ── Main action ──────────────────────────────────────────────────────────
  readonly addVacationBtn: Locator;

  // ── Vacation form modal fields ───────────────────────────────────────────
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly tripTypeSelect: Locator;
  readonly transportationSelect: Locator;
  readonly accommodationsInput: Locator;
  readonly createVacationBtn: Locator;

  // ── Detail-view tabs (inside the expanded vacation card) ─────────────────
  readonly activitiesTab: Locator;
  readonly itineraryTab: Locator;
  readonly excursionsTab: Locator;
  readonly flightsTab: Locator;

  // ── Itinerary tab content ────────────────────────────────────────────────
  readonly addLegBtn: Locator;

  // ── Excursions tab content ───────────────────────────────────────────────
  readonly noLegsMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.heading = page.getByRole('heading', { name: 'Vacations' });
    // The sidebar "Vacations" button is the only nav item whose text is exactly "Vacations"
    this.sidebarLink = page.getByRole('button', { name: /^Vacations$/ });

    // "Add Vacation" primary button (outside any modal)
    this.addVacationBtn = page.getByRole('button', { name: 'Add Vacation' });

    // Form modal – fields are plain label + sibling input (no for/id association),
    // so we scope each to the form that contains the "Create Vacation" submit button
    // then locate by CSS adjacent-sibling combinator.
    const modal = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create Vacation' }) });
    this.titleInput = modal.locator('label:has-text("Title") + input');
    this.descriptionInput = modal.locator('label:has-text("Description") + textarea');
    this.startDateInput = modal.locator('label:has-text("Start Date") + input');
    this.endDateInput = modal.locator('label:has-text("End Date") + input');
    this.tripTypeSelect = modal.locator('label:has-text("Trip Type") + select');
    this.transportationSelect = modal.locator('label:has-text("Primary Transportation") + select');
    this.accommodationsInput = modal.locator('label:has-text("Accommodations") + input');
    this.createVacationBtn = page.getByRole('button', { name: 'Create Vacation' });

    // Tabs inside the expanded vacation detail section (emoji-prefixed labels)
    this.activitiesTab = page.getByRole('button', { name: /✅\s*Activities/ });
    this.itineraryTab = page.getByRole('button', { name: /🗺️\s*Itinerary/ });
    this.excursionsTab = page.getByRole('button', { name: /🎯\s*Excursions/ });
    this.flightsTab = page.getByRole('button', { name: /✈️\s*Flights/ });

    // Itinerary tab
    this.addLegBtn = page.getByRole('button', { name: '+ Add Leg' });

    // Excursions tab – message shown when no itinerary legs exist
    this.noLegsMessage = page.getByText(
      'Add trip legs in the Itinerary tab first to manage excursions.'
    );
  }

  // ── Navigation methods ───────────────────────────────────────────────────

  /**
   * Navigate directly to the dashboard. The Vacations module is the default
   * active module so this effectively lands on the Vacations view.
   */
  async gotoViaUrl(): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Navigate to the dashboard and then activate the Vacations module by
   * clicking its link in the left sidebar navigation.
   */
  async gotoViaSidebar(): Promise<void> {
    await this.page.goto('/dashboard');
    // Switch to a different module first so the sidebar click is meaningful
    await this.page.getByRole('button', { name: 'Trip Planning' }).click();
    await this.sidebarLink.click();
    await expect(this.heading).toBeVisible();
  }

  // ── Locator helpers ──────────────────────────────────────────────────────

  /**
   * Returns a locator for the h3 title element inside a vacation card.
   */
  vacationCard(title: string): Locator {
    return this.page.getByRole('heading', { name: title });
  }

  /**
   * Opens the detail section for the vacation card with the given title by
   * clicking the appropriate quick-access button on the card.
   */
  async openVacationDetail(title: string, tab: VacationTab = 'Activities'): Promise<void> {
    // Locate the card that contains the given title heading
    const card = this.page
      .locator('div.bg-white.rounded-lg.shadow-md')
      .filter({ has: this.page.getByRole('heading', { name: title, level: 3 }) });

    // Click the matching quick-access button on the card (outside the tab bar)
    await card.getByRole('button', { name: tab }).click();
  }

  // ── Action methods ───────────────────────────────────────────────────────

  /**
   * Opens the Add Vacation modal, fills all provided fields, and submits the form.
   */
  async createVacation(details: VacationDetails): Promise<void> {
    await this.addVacationBtn.click();
    await this.titleInput.fill(details.title);
    if (details.description) {
      await this.descriptionInput.fill(details.description);
    }
    await this.startDateInput.fill(details.startDate);
    await this.endDateInput.fill(details.endDate);
    if (details.tripType) {
      await this.tripTypeSelect.selectOption(details.tripType);
    }
    if (details.transportation) {
      await this.transportationSelect.selectOption(details.transportation);
    }
    if (details.accommodations) {
      await this.accommodationsInput.fill(details.accommodations);
    }
    await this.createVacationBtn.click();
  }

  /**
   * Clicks one of the tab buttons inside the currently-expanded vacation
   * detail section.
   */
  async switchTab(tabName: VacationTab): Promise<void> {
    const tabLocatorMap: Record<VacationTab, Locator> = {
      Activities: this.activitiesTab,
      Itinerary: this.itineraryTab,
      Excursions: this.excursionsTab,
      Flights: this.flightsTab,
    };
    await tabLocatorMap[tabName].click();
  }

  /**
   * Handles the "Add Activity" flow within the Activities tab.
   * Assumes the Activities tab is already active.
   */
  async addActivity(activityDetails: ActivityDetails): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Activity' }).click();
    await this.page.getByPlaceholder('Activity Name').fill(activityDetails.name);
    if (activityDetails.description) {
      await this.page.getByPlaceholder('Description').fill(activityDetails.description);
    }
    if (activityDetails.date) {
      // The date input has no placeholder or label; it is the only date input in the activity form
      await this.page.locator('div.bg-gray-50 input[type="date"]').fill(activityDetails.date);
    }
    if (activityDetails.location) {
      await this.page.getByPlaceholder('Location').fill(activityDetails.location);
    }
    await this.page.locator('div.bg-gray-50').getByRole('button', { name: 'Add' }).click();
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  /** Assert that the Vacations module heading is visible. */
  async expectVacationsHeading(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }
}
