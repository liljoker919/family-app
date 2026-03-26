import { expect, type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  // ── Header ───────────────────────────────────────────────────────────────
  readonly heading: Locator;
  readonly headerWelcome: Locator;
  readonly familyNameText: Locator;
  readonly signOutBtn: Locator;

  // ── Loading state ─────────────────────────────────────────────────────────
  readonly loadingIndicator: Locator;

  // ── Sidebar navigation ───────────────────────────────────────────────────
  readonly vacationsNavBtn: Locator;
  readonly tripPlanningNavBtn: Locator;
  readonly propertyNavBtn: Locator;
  readonly carsNavBtn: Locator;
  readonly calendarNavBtn: Locator;
  readonly cookbookNavBtn: Locator;
  readonly choresNavBtn: Locator;
  readonly reportingNavBtn: Locator;

  // ── Main content area ────────────────────────────────────────────────────
  readonly mainContent: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.heading = page.getByRole('heading', { name: 'Family Dashboard' });
    this.headerWelcome = page.locator('header').locator('p').filter({ hasText: /Welcome,/ });
    this.familyNameText = page.locator('header span').filter({ hasText: /·/ });
    this.signOutBtn = page.getByRole('button', { name: 'Sign Out' });

    // Loading state – shown while family membership data is being fetched
    this.loadingIndicator = page.getByText('Loading…');

    // Sidebar navigation buttons – scoped to the aside to avoid matches inside
    // module content areas that may contain identically named buttons.
    const sidebar = page.locator('aside');
    this.vacationsNavBtn = sidebar.getByRole('button', { name: /^Vacations$/ });
    this.tripPlanningNavBtn = sidebar.getByRole('button', { name: /^Trip Planning$/ });
    this.propertyNavBtn = sidebar.getByRole('button', { name: /^Property$/ });
    this.carsNavBtn = sidebar.getByRole('button', { name: /^Cars$/ });
    this.calendarNavBtn = sidebar.getByRole('button', { name: /^Calendar$/ });
    this.cookbookNavBtn = sidebar.getByRole('button', { name: /^Cookbook$/ });
    this.choresNavBtn = sidebar.getByRole('button', { name: /^Chores$/ });
    this.reportingNavBtn = sidebar.getByRole('button', { name: /^Reporting$/ });

    // Main content
    this.mainContent = page.getByRole('main');
  }

  // ── Navigation methods ───────────────────────────────────────────────────

  /**
   * Navigate to the dashboard URL and wait for the family membership data to
   * finish loading so the full dashboard UI is visible.
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.loadingIndicator.waitFor({ state: 'hidden' });
    await expect(this.heading).toBeVisible();
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  /**
   * Assert that the dashboard header displays the signed-in user's email
   * address and the family name separator (·).
   */
  async expectHeaderInfo(email: string): Promise<void> {
    await expect(this.headerWelcome).toContainText(email);
    await expect(this.familyNameText).toBeVisible();
  }

  /** Assert that the Family Dashboard heading is visible. */
  async expectDashboardHeading(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }
}
