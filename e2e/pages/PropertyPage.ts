import { expect, type Locator, type Page } from '@playwright/test';

export interface PropertyDetails {
  name: string;
  address?: string;
}

export interface TransactionDetails {
  category: 'RENT_INCOME' | 'MORTGAGE' | 'TAXES' | 'MAINTENANCE' | 'INSURANCE';
  amount: string;
  date: string;
  description?: string;
}

export class PropertyPage {
  readonly page: Page;

  // ── Navigation ───────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly sidebarLink: Locator;

  // ── Main action ──────────────────────────────────────────────────────────
  readonly addPropertyBtn: Locator;

  // ── Add Property form modal ──────────────────────────────────────────────
  readonly addPropertyModalHeading: Locator;
  readonly propertyNameInput: Locator;
  readonly propertyAddressInput: Locator;
  readonly createPropertyBtn: Locator;

  // ── Log Transaction form modal ───────────────────────────────────────────
  readonly logTransactionModalHeading: Locator;
  readonly categorySelect: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly descriptionInput: Locator;
  readonly typeBadge: Locator;
  readonly saveTransactionBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.heading = page.getByRole('heading', { name: 'Property P&L Tracker' });
    this.sidebarLink = page.locator('aside').getByRole('button', { name: /^Property$/ });

    // "Add Property" primary button (outside any modal)
    this.addPropertyBtn = page.getByRole('button', { name: 'Add Property' });

    // Add Property modal – scope to the form containing "Create Property"
    const propertyModal = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Create Property' }) });
    this.addPropertyModalHeading = page.getByRole('heading', { name: 'Add New Property' });
    this.propertyNameInput = propertyModal.locator('label:has-text("Property Name") + input');
    this.propertyAddressInput = propertyModal.locator('label:has-text("Address") + input');
    this.createPropertyBtn = page.getByRole('button', { name: 'Create Property' });

    // Log Transaction modal – scope to the form containing "Save Transaction"
    const transactionModal = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Save Transaction' }) });
    this.logTransactionModalHeading = page.getByRole('heading', { name: 'Log Transaction' });
    this.categorySelect = transactionModal.locator('select');
    this.amountInput = transactionModal.locator('label:has-text("Amount") + input');
    this.dateInput = transactionModal.locator('label:has-text("Date") + input');
    this.descriptionInput = transactionModal.locator('label:has-text("Description") + input');
    this.typeBadge = transactionModal.locator('span').filter({ hasText: /▲ Income|▼ Expense/ });
    this.saveTransactionBtn = page.getByRole('button', { name: 'Save Transaction' });
  }

  // ── Navigation methods ───────────────────────────────────────────────────

  /**
   * Activate the Property module from the already-loaded dashboard.
   */
  async goto(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/i);
    await this.sidebarLink.click();
    await expect(this.heading).toBeVisible();
  }

  // ── Locator helpers ──────────────────────────────────────────────────────

  /**
   * Returns a locator for the property card identified by name (displayed as
   * the card's h3 heading).
   */
  getPropertyCard(name: string): Locator {
    return this.page
      .locator('div.bg-white.rounded-xl.shadow-md')
      .filter({ has: this.page.getByRole('heading', { name, level: 3 }) });
  }

  /**
   * Returns a locator for the Total Income value shown in the summary bar of
   * the property card identified by name.
   */
  getIncomeTotal(name: string): Locator {
    return this.getPropertyCard(name)
      .locator('p.text-xs', { hasText: /Total Income/i })
      .locator('+ p');
  }

  /**
   * Returns a locator for the Total Expenses value shown in the summary bar
   * of the property card identified by name.
   */
  getExpensesTotal(name: string): Locator {
    return this.getPropertyCard(name)
      .locator('p.text-xs', { hasText: /Total Expenses/i })
      .locator('+ p');
  }

  /**
   * Returns a locator for the Net Income value shown in the summary bar of
   * the property card identified by name.
   */
  getNetIncome(name: string): Locator {
    return this.getPropertyCard(name)
      .locator('p.text-xs', { hasText: /Net Income/i })
      .locator('+ p');
  }

  // ── Action methods ───────────────────────────────────────────────────────

  /**
   * Opens the Add Property modal, fills the provided fields, and submits the
   * form.
   */
  async createProperty(details: PropertyDetails): Promise<void> {
    await this.addPropertyBtn.click();
    await this.propertyNameInput.fill(details.name);
    if (details.address) {
      await this.propertyAddressInput.fill(details.address);
    }
    await this.createPropertyBtn.click();
  }

  /**
   * Clicks the delete icon (🗑️) on the given property card and confirms via
   * the custom modal dialog.
   */
  async deleteProperty(name: string): Promise<void> {
    const card = this.getPropertyCard(name);
    await card.getByTitle('Delete property').click();
    await this.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  }

  /**
   * Clicks the "View Ledger" toggle on the given property card to expand the
   * ledger and reveal the "Log Transaction" button.
   */
  async expandLedger(name: string): Promise<void> {
    const card = this.getPropertyCard(name);
    await card.getByRole('button', { name: /▼ View Ledger/ }).click();
  }

  /**
   * Opens the Log Transaction modal for the given property (the ledger must
   * already be expanded), fills all provided fields, and submits the form.
   */
  async logTransaction(propertyName: string, details: TransactionDetails): Promise<void> {
    const card = this.getPropertyCard(propertyName);
    await card.getByRole('button', { name: /\+ Log Transaction/ }).click();
    await this.categorySelect.selectOption(details.category);
    await this.amountInput.fill(details.amount);
    await this.dateInput.fill(details.date);
    if (details.description) {
      await this.descriptionInput.fill(details.description);
    }
    await this.saveTransactionBtn.click();
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  /** Assert that the Property P&L Tracker heading is visible. */
  async expectPropertyHeading(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }
}
