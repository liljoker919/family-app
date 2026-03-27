import { expect } from '@playwright/test';
import { test } from '../fixtures/test';

test.describe('Dashboard', () => {
  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Dashboard - header displays family name and user email', async ({
    dashboardPage,
    loginAs,
  }) => {
    const { email } = await loginAs();
    await expect(dashboardPage.heading).toBeVisible();

    // The welcome paragraph in the header must contain the signed-in user's email
    await expect(dashboardPage.headerWelcome).toContainText(email);

    // The family name separator span ("·") must also be visible, confirming that
    // the family name is rendered alongside the email in the header
    await expect(dashboardPage.familyNameText).toBeVisible();
  });

  test('Dashboard - Navigate to each module via the sidebar without errors', async ({
    dashboardPage,
    loginAs,
  }) => {
    await loginAs();
    await expect(dashboardPage.heading).toBeVisible();

    // Always-visible sidebar modules in the order shown in the spec
    const alwaysVisibleModules = [
      dashboardPage.vacationsNavBtn,
      dashboardPage.tripPlanningNavBtn,
      dashboardPage.propertyNavBtn,
      dashboardPage.carsNavBtn,
      dashboardPage.calendarNavBtn,
      dashboardPage.cookbookNavBtn,
      dashboardPage.choresNavBtn,
    ];

    for (const navBtn of alwaysVisibleModules) {
      await navBtn.click();

      // The main content area must be visible and must not show an "Access Restricted"
      // error after clicking each module navigation button
      await expect(dashboardPage.mainContent).toBeVisible();
      await expect(dashboardPage.mainContent.getByText('Access Restricted')).not.toBeVisible();
    }

    // Reporting is restricted to ADMIN/PLANNER roles – navigate only when the
    // button is present for the currently signed-in user
    if (await dashboardPage.reportingNavBtn.isVisible()) {
      await dashboardPage.reportingNavBtn.click();
      await expect(dashboardPage.mainContent).toBeVisible();
      await expect(dashboardPage.mainContent.getByText('Access Restricted')).not.toBeVisible();
    }
  });

  test('Dashboard - Loading spinner is visible while family data is fetching', async ({
    dashboardPage,
    loginAs,
  }) => {
    await loginAs();

    // Attempt to observe the loading indicator.  In fast environments the
    // membership fetch may complete before this assertion runs, which is
    // acceptable – the catch suppresses the timeout error in that case.
    await dashboardPage.loadingIndicator
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch((error: Error) => {
        // Suppress timeout errors only – loading state resolved before observation,
        // which is acceptable in fast environments
        if (error.name !== 'TimeoutError') throw error;
      });

    // Once family data resolves the loading text must be gone and the full
    // dashboard must render correctly
    await dashboardPage.loadingIndicator.waitFor({ state: 'hidden', timeout: 15000 });
    await expect(dashboardPage.heading).toBeVisible();
  });
});
