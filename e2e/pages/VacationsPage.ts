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

export interface FlightSegmentDetails {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  /** Format: 'YYYY-MM-DDTHH:MM' */
  departureDateTime: string;
  /** Format: 'YYYY-MM-DDTHH:MM' */
  arrivalDateTime: string;
  confirmationNumber?: string;
  notes?: string;
}

export interface TripLegDetails {
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface ExcursionDetails {
  name: string;
  status?: 'PROPOSED' | 'UNDER_REVIEW' | 'SELECTED' | 'BOOKED' | 'REJECTED';
  description?: string;
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

  // ── Flights tab content ──────────────────────────────────────────────────
  readonly addFlightSegmentBtn: Locator;
  readonly flightSegmentFormError: Locator;

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

    // Flights tab
    this.addFlightSegmentBtn = page.getByRole('button', { name: '+ Add Flight Segment' });
    this.flightSegmentFormError = page.getByText('Arrival date/time must be after departure date/time.');

    // Excursions tab – message shown when no itinerary legs exist
    this.noLegsMessage = page.getByText(
      'Add trip legs in the Itinerary tab first to manage excursions.'
    );
  }

  // ── Navigation methods ───────────────────────────────────────────────────

  /**
   * Use the post-login dashboard landing where Vacations is the default
   * active module.
   */
  async gotoViaUrl(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/i);
    await expect(this.heading).toBeVisible();
  }

  /**
   * Activate the Vacations module from the already-loaded dashboard by
   * clicking its link in the left sidebar navigation.
   */
  async gotoViaSidebar(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/i);
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

  // ── Flight segment helpers ────────────────────────────────────────────────

  /**
   * In the Flights tab, opens the "Add Flight Segment" form, fills all
   * provided fields, and submits.  If validation fails the form stays open
   * with an error message (asserted separately via `flightSegmentFormError`).
   */
  async addFlightSegment(details: FlightSegmentDetails): Promise<void> {
    await this.addFlightSegmentBtn.click();
    const flightForm = this.page.locator('div').filter({
      has: this.page.locator('h5', { hasText: 'New Flight Segment' }),
    });
    await this.page.getByPlaceholder('Airline *').fill(details.airline);
    await this.page.getByPlaceholder('Flight Number *').fill(details.flightNumber);
    await this.page.getByPlaceholder('Departure Airport *').fill(details.departureAirport);
    await this.page.getByPlaceholder('Arrival Airport *').fill(details.arrivalAirport);
    await flightForm
      .locator('label:has-text("Departure Date/Time") + input')
      .fill(details.departureDateTime);
    await flightForm
      .locator('label:has-text("Arrival Date/Time") + input')
      .fill(details.arrivalDateTime);
    if (details.confirmationNumber) {
      await this.page.getByPlaceholder('Confirmation Number').fill(details.confirmationNumber);
    }
    if (details.notes) {
      await this.page.getByPlaceholder('Notes').fill(details.notes);
    }
    await flightForm.getByRole('button', { name: 'Save' }).click();
  }

  /**
   * Returns a locator for a saved flight segment card identified by airline
   * and flight number (displayed as "✈️ {airline} · {flightNumber}").
   */
  flightSegmentCard(airline: string, flightNumber: string): Locator {
    return this.page.getByText(`${airline} · ${flightNumber}`);
  }

  // ── Trip-leg helpers ──────────────────────────────────────────────────────

  /**
   * In the Itinerary tab, opens the "Add Leg" form, fills the required name
   * and optional dates, then submits.
   */
  async addLeg(details: TripLegDetails): Promise<void> {
    await this.addLegBtn.click();
    await this.page.getByPlaceholder('Leg Name (e.g. Outbound Flight, Paris Stay)').fill(details.name);
    const legForm = this.page.locator('div').filter({
      has: this.page.locator('h5', { hasText: 'New Trip Leg' }),
    });
    if (details.startDate || details.endDate) {
      const dateInputs = legForm.locator('input[type="date"]');
      if (details.startDate) await dateInputs.nth(0).fill(details.startDate);
      if (details.endDate) await dateInputs.nth(1).fill(details.endDate);
    }
    await legForm.getByRole('button', { name: 'Add Leg', exact: true }).click();
  }

  // ── Excursion helpers ─────────────────────────────────────────────────────

  /**
   * In the Excursions tab, clicks the leg-selection button for the given leg
   * name to load that leg's excursions.
   */
  async selectLegInExcursions(legName: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(legName) }).click();
  }

  /**
   * Opens the "Propose Excursion" form, fills it in, and submits.
   */
  async proposeExcursion(details: ExcursionDetails): Promise<void> {
    await this.page.getByRole('button', { name: '+ Propose Excursion' }).click();
    await this.page.getByPlaceholder('Excursion Name *').fill(details.name);
    if (details.description) {
      const excursionForm = this.page.locator('div').filter({
        has: this.page.locator('h5', { hasText: 'Propose Excursion Option' }),
      });
      await excursionForm.locator('textarea').fill(details.description);
    }
    if (details.status) {
      const excursionForm = this.page.locator('div').filter({
        has: this.page.locator('h5', { hasText: 'Propose Excursion Option' }),
      });
      await excursionForm.locator('select').selectOption(details.status);
    }
    await this.page.getByRole('button', { name: 'Propose', exact: true }).click();
  }

  /**
   * Returns a locator scoped to the excursion card identified by the given
   * excursion name (displayed inside an `<h5>` element).
   */
  excursionCard(name: string): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.locator('h5', { hasText: name }) })
      .filter({ has: this.page.getByRole('button', { name: /👍/ }) })
      .first();
  }

  /**
   * Clicks the 👍 upvote button on the excursion card with the given name.
   */
  async voteUpOnExcursion(excursionName: string): Promise<void> {
    await this.excursionCard(excursionName).getByRole('button', { name: /👍/ }).click();
  }

  /**
   * Opens the comments section for the excursion with the given name by
   * clicking its "💬 Comments" button.
   */
  async openExcursionComments(excursionName: string): Promise<void> {
    await this.excursionCard(excursionName)
      .getByRole('button', { name: /💬 Comments/ })
      .click();
  }

  /**
   * Types `comment` into the comment input and clicks "Post" to submit it.
   * Assumes `openExcursionComments` has already been called.
   */
  async postExcursionComment(comment: string): Promise<void> {
    await this.page.getByPlaceholder('Add your opinion...').fill(comment);
    await this.page.getByRole('button', { name: 'Post' }).click();
  }

  // ── Activity feedback helpers ─────────────────────────────────────────────

  /**
   * Clicks the "Feedback" button on the activity card matching `activityName`
   * to open the inline star-rating form.
   */
  async openActivityFeedback(activityName: string): Promise<void> {
    const card = this.page
      .locator('div')
      .filter({ has: this.page.locator('h5', { hasText: activityName }) })
      .filter({ has: this.page.getByRole('button', { name: 'Feedback' }) })
      .first();
    await card.getByRole('button', { name: 'Feedback' }).click();
  }

  /**
   * Selects a star `rating` (1–5), enters a `comment`, and submits the
   * activity feedback form.  Assumes the form is already open.
   */
  async submitActivityFeedback(rating: number, comment: string): Promise<void> {
    const form = this.page.locator('form').filter({
      has: this.page.getByRole('button', { name: 'Submit Feedback' }),
    });
    // Star buttons are 1–5, in order; click the Nth one (0-indexed)
    await form.locator('button[type="button"]').nth(rating - 1).click();
    await form.getByPlaceholder('Leave a comment...').fill(comment);
    await form.getByRole('button', { name: 'Submit Feedback' }).click();
  }
}
