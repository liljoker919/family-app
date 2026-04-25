import { expect, type Locator, type Page } from '@playwright/test';

export interface ChoreDetails {
  title: string;
  description?: string;
  category?: 'CLEANING' | 'LAUNDRY' | 'COOKING' | 'YARD' | 'PETS' | 'ERRANDS' | 'OTHER';
  recurrence?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONE_TIME';
  pointValue?: string;
}

export interface AssignmentDetails {
  assignedTo: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface CompletionDetails {
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

export class ChoresPage {
  readonly page: Page;

  // ── Navigation ───────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly sidebarLink: Locator;
  readonly dashboardHeading: Locator;
  readonly loadingIndicator: Locator;

  // ── Main action ──────────────────────────────────────────────────────────
  readonly addChoreBtn: Locator;

  // ── Tab navigation ───────────────────────────────────────────────────────
  readonly myChoresTab: Locator;
  readonly allChoresTab: Locator;
  readonly assignmentsTab: Locator;
  readonly completionHistoryTab: Locator;

  // ── Chore form modal ─────────────────────────────────────────────────────
  readonly choreFormHeading: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly categorySelect: Locator;
  readonly recurrenceSelect: Locator;
  readonly pointValueInput: Locator;
  readonly saveChoreBtn: Locator;
  readonly updateChoreBtn: Locator;
  readonly cancelChoreBtn: Locator;

  // ── Assign form modal ────────────────────────────────────────────────────
  readonly assignFormHeading: Locator;
  readonly assignedToInput: Locator;
  readonly assignBtn: Locator;
  readonly cancelAssignBtn: Locator;

  // ── Log Completion form modal ─────────────────────────────────────────────
  readonly logCompletionHeading: Locator;
  readonly completedByInput: Locator;
  readonly completedAtInput: Locator;
  readonly logCompletionBtn: Locator;
  readonly cancelCompletionBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.heading = page.getByRole('heading', { name: 'Chores' });
    this.sidebarLink = page.locator('aside').getByRole('button', { name: 'Chores', exact: true });
    this.dashboardHeading = page.getByRole('heading', { name: 'Family Dashboard' });
    this.loadingIndicator = page.getByText('Loading…');

    // "Add Chore" primary button (outside any modal)
    this.addChoreBtn = page.getByRole('button', { name: 'Add Chore' });

    // Tabs
    this.myChoresTab = page.getByRole('button', { name: 'My Chores' });
    this.allChoresTab = page.getByRole('button', { name: 'All Chores' });
    this.assignmentsTab = page.getByRole('button', { name: 'Assignments' });
    this.completionHistoryTab = page.getByRole('button', { name: 'Completion History' });

    // Chore form modal – scope to the form that contains the save/update submit button
    const choreModal = page
      .locator('form')
      .filter({ has: page.locator('button[type="submit"]').filter({ hasText: /Save Chore|Update Chore/ }) });
    this.choreFormHeading = page.getByRole('heading', { name: /Add New Chore|Edit Chore/ });
    this.titleInput = choreModal.locator('label:has-text("Title") + input');
    this.descriptionInput = choreModal.locator('label:has-text("Description") + textarea');
    this.categorySelect = choreModal.locator('label:has-text("Category") + select');
    this.recurrenceSelect = choreModal.locator('label:has-text("Recurrence") + select');
    this.pointValueInput = choreModal.locator('label:has-text("Point Value") + input');
    this.saveChoreBtn = page.getByRole('button', { name: 'Save Chore' });
    this.updateChoreBtn = page.getByRole('button', { name: 'Update Chore' });
    this.cancelChoreBtn = choreModal.getByRole('button', { name: 'Cancel' });

    // Assign form modal – scope to the form that contains the "Assign" submit button
    const assignModal = page
      .locator('form')
      .filter({ has: page.locator('button[type="submit"]').filter({ hasText: 'Assign' }) });
    this.assignFormHeading = page.getByRole('heading', { name: 'Assign Chore' });
    this.assignedToInput = assignModal.locator('label:has-text("Assign To") + input');
    this.assignBtn = assignModal.getByRole('button', { name: 'Assign', exact: true });
    this.cancelAssignBtn = assignModal.getByRole('button', { name: 'Cancel' });

    // Log Completion modal – scope to the form containing "Log Completion" submit button
    const completionModal = page
      .locator('form')
      .filter({ has: page.locator('button[type="submit"]').filter({ hasText: 'Log Completion' }) });
    this.logCompletionHeading = page.getByRole('heading', { name: 'Log Completion' });
    this.completedByInput = completionModal.locator('label:has-text("Completed By") + input');
    this.completedAtInput = completionModal.locator('label:has-text("Completed At") + input');
    this.logCompletionBtn = page.getByRole('button', { name: 'Log Completion' });
    this.cancelCompletionBtn = completionModal.getByRole('button', { name: 'Cancel' });
  }

  // ── Navigation methods ───────────────────────────────────────────────────

  /**
   * Navigate to the dashboard and activate the Chores module by clicking its
   * link in the left sidebar navigation.
   */
  async goto(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/i);
    await this.loadingIndicator.waitFor({ state: 'hidden' }).catch(() => undefined);
    await expect(this.dashboardHeading).toBeVisible();
    await this.sidebarLink.click();
    await expect(this.heading).toBeVisible();
  }

  // ── Locator helpers ──────────────────────────────────────────────────────

  /**
   * Returns a locator for the chore row/card identified by its title (displayed
   * as the card's h3 heading inside the All Chores tab).
   */
  getChoreRow(title: string): Locator {
    return this.page
      .locator('div.bg-white.rounded-lg.shadow')
      .filter({ has: this.page.getByRole('heading', { name: title, level: 3 }) });
  }

  /**
   * Returns a locator that matches the chore title text in the Assignments tab,
   * scoped to the assignment row that contains that title.
   */
  getAssignmentRow(choreTitle: string): Locator {
    return this.page
      .locator('div.bg-white.rounded-lg.shadow')
      .filter({ has: this.page.locator('span.font-semibold', { hasText: choreTitle }) });
  }

  /**
   * Returns a locator for the completion row identified by its chore title
   * inside the Completion History tab.
   */
  getCompletionRow(choreTitle: string): Locator {
    return this.page
      .locator('div.bg-white.rounded-lg.shadow')
      .filter({ has: this.page.locator('span.font-semibold', { hasText: choreTitle }) });
  }

  // ── Action methods ───────────────────────────────────────────────────────

  /**
   * Navigate to the All Chores tab.
   */
  async switchToAllChores(): Promise<void> {
    await this.allChoresTab.click();
  }

  /**
   * Navigate to the Assignments tab.
   */
  async switchToAssignments(): Promise<void> {
    await this.assignmentsTab.click();
  }

  /**
   * Navigate to the Completion History tab.
   */
  async switchToCompletionHistory(): Promise<void> {
    await this.completionHistoryTab.click();
  }

  /**
   * Opens the Add Chore modal, fills all provided fields, and submits the form.
   */
  async createChore(details: ChoreDetails): Promise<void> {
    await this.addChoreBtn.click();
    await this.titleInput.fill(details.title);
    if (details.description) {
      await this.descriptionInput.fill(details.description);
    }
    if (details.category) {
      await this.categorySelect.selectOption(details.category);
    }
    if (details.recurrence) {
      await this.recurrenceSelect.selectOption(details.recurrence);
    }
    if (details.pointValue) {
      await this.pointValueInput.fill(details.pointValue);
    }
    await this.saveChoreBtn.click();
  }

  /**
   * Opens the Edit Chore form for the chore identified by title, updates the
   * provided fields, and submits the form.  Assumes the All Chores tab is active.
   */
  async editChore(choreTitle: string, updates: Partial<ChoreDetails>): Promise<void> {
    const row = this.getChoreRow(choreTitle);
    await row.getByRole('button', { name: 'Edit' }).click();
    if (updates.title !== undefined) {
      await this.titleInput.clear();
      await this.titleInput.fill(updates.title);
    }
    if (updates.pointValue !== undefined) {
      await this.pointValueInput.clear();
      await this.pointValueInput.fill(updates.pointValue);
    }
    if (updates.category !== undefined) {
      await this.categorySelect.selectOption(updates.category);
    }
    if (updates.recurrence !== undefined) {
      await this.recurrenceSelect.selectOption(updates.recurrence);
    }
    await this.updateChoreBtn.click();
  }

  /**
   * Deletes the chore identified by title.
   * Clicks the Delete button and confirms via the custom modal dialog.
   * Assumes the All Chores tab is active.
   */
  async deleteChore(choreTitle: string): Promise<void> {
    const row = this.getChoreRow(choreTitle);
    await row.getByRole('button', { name: 'Delete' }).click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  }

  /**
   * Opens the Assign form for a chore identified by title, fills the provided
   * assignment details, and submits.  Assumes the All Chores tab is active.
   */
  async assignChore(choreTitle: string, details: AssignmentDetails): Promise<void> {
    const row = this.getChoreRow(choreTitle);
    await row.getByRole('button', { name: 'Assign' }).click();
    await this.assignedToInput.fill(details.assignedTo);
    await this.assignBtn.click();
  }

  /**
   * Opens the Log Completion form for the chore identified by title and
   * submits it.  Assumes the All Chores tab is active and the current user has
   * permission (is a manager or assigned to the chore).
   */
  async logChoreCompletion(choreTitle: string, details?: Partial<CompletionDetails>): Promise<void> {
    const row = this.getChoreRow(choreTitle);
    await row.getByRole('button', { name: /Log Done/ }).click();
    if (details?.completedBy !== undefined) {
      await this.completedByInput.clear();
      await this.completedByInput.fill(details.completedBy);
    }
    await this.logCompletionBtn.click();
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  /** Assert that the Chores module heading is visible. */
  async expectChoresHeading(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }
}
