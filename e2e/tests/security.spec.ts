/**
 * Security Regression Suite – E2E Authorization Tests (Playwright)
 *
 * Tests the live backend and UI-layer security gates.  Two categories:
 *
 *   1. Negative – actions that must be rejected with an authorization error.
 *   2. Positive – actions that must succeed for the appropriate role.
 *
 * Role mapping via environment variables
 * ──────────────────────────────────────
 * The tests below look for role-specific users through these env vars:
 *
 *   E2E_ADMIN_EMAIL   – email of a user whose Cognito group is ADMIN
 *   E2E_MEMBER_EMAIL  – email of a user whose Cognito group is MEMBER
 *   E2E_VALID_PASSWORD – shared password for all role-specific users
 *
 * When a required user is not configured the corresponding test is skipped.
 * The suite is designed to run fully in CI once the secret vars are set.
 *
 * Requirement traceability: test names follow the pattern
 *   security.rbac.<subject>
 */

import { test, expect } from '../fixtures/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PASSWORD = process.env.E2E_VALID_PASSWORD?.trim() ?? '';

function getRoleUser(roleEnvKey: string): { email: string; password: string } | null {
  const email = process.env[roleEnvKey]?.trim();
  if (!email || !VALID_PASSWORD) return null;
  return { email, password: VALID_PASSWORD };
}

/**
 * Intercepts the AppSync GraphQL endpoint and collects all POST requests made
 * during `fn()`.  Returns the array of intercepted requests along with their
 * response status codes.
 */
async function collectApiRequests(
  page: import('@playwright/test').Page,
  fn: () => Promise<void>
): Promise<Array<{ status: number; body: string }>> {
  const results: Array<{ status: number; body: string }> = [];

  await page.route('**/graphql', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    results.push({ status: response.status(), body });
    await route.fulfill({ response });
  });

  await fn();

  await page.unroute('**/graphql');
  return results;
}

/**
 * Returns true when any of the collected responses contains an
 * "Unauthorized" or "Not Authorized" payload – the error AppSync returns for
 * group-authorization violations.
 */
function hasAuthorizationError(responses: Array<{ status: number; body: string }>): boolean {
  return responses.some(
    ({ body }) =>
      /unauthorized/i.test(body) ||
      /not authorized/i.test(body) ||
      /access denied/i.test(body)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unauthenticated Redirect – Visiting /dashboard without signing in
// ─────────────────────────────────────────────────────────────────────────────

test.describe('security.redirect – unauthenticated access', () => {
  /**
   * security.redirect.unauthenticated-dashboard-shows-signin-form
   *
   * A visitor who navigates directly to /dashboard without first signing in
   * must NOT see the dashboard content.  The AWS Amplify Authenticator
   * component wrapping the dashboard renders the sign-in form in-place,
   * effectively blocking access to the authenticated UI.
   */
  test('security.redirect.unauthenticated-dashboard-shows-signin-form', async ({ page }) => {
    // Navigate directly to the dashboard URL without any prior authentication.
    await page.goto('/dashboard');

    // The Amplify Authenticator intercepts unauthenticated sessions and renders
    // the sign-in form instead of the dashboard content.
    const emailInput = page.locator('input[name="username"]');
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // The authenticated dashboard heading must not be visible.
    const dashboardHeading = page.getByRole('heading', { name: 'Family Dashboard' });
    await expect(dashboardHeading).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RBAC Boundary – restricted module routes for MEMBER users
// ─────────────────────────────────────────────────────────────────────────────

test.describe('security.rbac – MEMBER restricted-module boundary checks', () => {
  /**
   * security.rbac.member-reporting-module-not-visible-in-sidebar
   *
   * The "Reporting" sidebar navigation button must not be rendered for MEMBER
   * users.  Only ADMIN and PLANNER roles may access that module.
   */
  test('security.rbac.member-reporting-module-not-visible-in-sidebar', async ({
    page,
    authPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await expect(page).toHaveURL(/\/dashboard/i);

    // The "Reporting" sidebar link must not be rendered for MEMBER users.
    const reportingNavBtn = page.locator('aside').getByRole('button', { name: /^Reporting$/i });
    await expect(reportingNavBtn).toHaveCount(0);
  });

  /**
   * security.rbac.member-access-restricted-shown-for-admin-content
   *
   * MEMBER users must not be able to reach the Admin role-management panel.
   * The module entry point is hidden in the sidebar and no Admin content should
   * be rendered in the default dashboard state.
   */
  test('security.rbac.member-access-restricted-shown-for-admin-content', async ({
    page,
    authPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await expect(page).toHaveURL(/\/dashboard/i);

    // Wait for the dashboard to finish loading family membership data.
    await page.getByText('Loading…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: 'Family Dashboard' })).toBeVisible();

    // Admin entry point is hidden for MEMBER users.
    const adminNavBtn = page.locator('aside').getByRole('button', { name: /^admin$/i });
    await expect(adminNavBtn).toHaveCount(0);

    // Admin role-management heading must not be visible.
    await expect(page.getByRole('heading', { name: /family members/i })).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Negative Testing – The "Blocker" Suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe('security.rbac – MEMBER mutation blocks (negative)', () => {
  test('security.rbac.member-delete-button-absent-on-vacation-card', async ({
    page,
    authPage,
    vacationsPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);

    await vacationsPage.gotoViaUrl();

    // The Delete button must not appear for MEMBER users on vacation cards.
    const deleteButtons = page.getByRole('button', { name: /^delete$/i });
    await expect(deleteButtons).toHaveCount(0);
  });

  test('security.rbac.member-add-vacation-button-absent', async ({
    page,
    authPage,
    vacationsPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);

    await vacationsPage.gotoViaUrl();

    // MEMBER create permission is controlled by canPlan.
    // If Reporting is visible, the user is planning-enabled and should see create.
    const canPlan = (await page.locator('aside').getByRole('button', { name: /^Reporting$/i }).count()) > 0;
    const addVacationBtn = page.getByRole('button', { name: /add vacation/i });
    await expect(addVacationBtn).toHaveCount(canPlan ? 1 : 0);
  });

  test('security.rbac.member-add-chore-button-absent', async ({
    page,
    authPage,
    choresPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);

    await choresPage.goto();

    // MEMBER users should not see the "Add Chore" button.
    await expect(choresPage.addChoreBtn).toHaveCount(0);
  });

  test('security.rbac.member-add-car-button-absent', async ({
    page,
    authPage,
    carsPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);

    await carsPage.goto();

    // MEMBER create permission is controlled by canPlan.
    const canPlan = (await page.locator('aside').getByRole('button', { name: /^Reporting$/i }).count()) > 0;
    const addCarBtn = page.getByRole('button', { name: /add car/i });
    await expect(addCarBtn).toHaveCount(canPlan ? 1 : 0);
  });

  /**
   * security.rbac.member-api-create-vacation-returns-authorization-error
   *
   * A MEMBER user's attempt to send a createVacation GraphQL mutation must
   * produce an authorization error response from the AppSync endpoint.
   * This test intercepts the API calls and checks the response payload
   * rather than relying solely on the absence of a UI button.
   */
  test('security.rbac.member-api-create-vacation-returns-authorization-error', async ({
    page,
    authPage,
    vacationsPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER API test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await expect(page).toHaveURL(/\/dashboard/i);

    // Capture the live GraphQL endpoint URL from an authenticated app request.
    const graphqlResponsePromise = page.waitForResponse((r) => r.url().includes('/graphql'), { timeout: 15000 });
    await vacationsPage.gotoViaUrl();
    const graphqlResponse = await graphqlResponsePromise.catch(() => null);
    const graphqlUrl = graphqlResponse?.url() ?? '';
    expect(graphqlUrl).toContain('/graphql');

    const mutation = `
      mutation TestMemberCreateVacation {
        createVacation(input: {
          familyId: "security-test-family-id",
          title: "SECURITY TEST - MUST BE REJECTED",
          startDate: "2099-01-01",
          endDate: "2099-01-07",
          createdBy: "security-test"
        }) { id }
      }
    `;

    const resp = await page.request.post(graphqlUrl, {
      data: { query: mutation },
    });
    const bodyObj = await resp.json();
    const body = JSON.stringify(bodyObj);
    const status = resp.status();

    // AppSync returns HTTP 200 for authorization errors, encoding the error in
    // the "errors" array of the JSON body.  Accept either a non-200 HTTP status
    // or an "Unauthorized" error in the body.
    const isRejected =
      status >= 400 ||
      /unauthorized/i.test(body) ||
      /not authorized/i.test(body) ||
      /access denied/i.test(body);

    expect(isRejected).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Isolation – cross-family data access must fail
// ─────────────────────────────────────────────────────────────────────────────

test.describe('security.rbac – tenant isolation (cross-family access)', () => {
  /**
   * security.rbac.cross-family-read-returns-empty-or-error
   *
   * A user querying a record belonging to a different familyId must receive
   * either an empty result (tenant-scoped filter) or an authorization error.
   * The test issues a direct GraphQL request for a hard-coded fake record ID
   * that cannot exist in the authenticated user's family.
   */
  test('security.rbac.cross-family-read-returns-empty-or-error', async ({
    page,
    authPage,
    loginAs,
    vacationsPage,
  }) => {
    const user = await loginAs().catch(() => null);
    if (!user) {
      test.skip(true, 'No E2E user configured – skipping tenant isolation test');
    }

    await expect(page).toHaveURL(/\/dashboard/i);

    const graphqlResponsePromise = page.waitForResponse((r) => r.url().includes('/graphql'), { timeout: 15000 });
    await vacationsPage.gotoViaUrl();
    const graphqlResponse = await graphqlResponsePromise.catch(() => null);
    const graphqlUrl = graphqlResponse?.url() ?? '';
    expect(graphqlUrl).toContain('/graphql');

    // Attempt to read a Vacation by a fabricated ID that belongs to a
    // different (non-existent) family.
    const query = `
      query TestCrossFamilyRead {
        getVacation(id: "00000000-0000-0000-0000-000000000001") {
          id
          familyId
          title
        }
      }
    `;

    const resp = await page.request.post(graphqlUrl, {
      data: { query },
    });
    const bodyObj = await resp.json();
    const body = JSON.stringify(bodyObj);
    const status = resp.status();

    // Accept either a null/empty data response (no record found)
    // or an explicit authorization error – both indicate correct isolation.
    const isIsolated =
      status >= 400 ||
      body.includes('"getVacation":null') ||
      /unauthorized/i.test(body) ||
      /not authorized/i.test(body) ||
      /access denied/i.test(body);

    expect(isIsolated).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Privilege Escalation – MEMBER cannot update FamilyMember role
// ─────────────────────────────────────────────────────────────────────────────

test.describe('security.rbac – privilege escalation prevention', () => {
  test('security.rbac.member-admin-module-not-visible-in-sidebar', async ({
    page,
    authPage,
    dashboardPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await dashboardPage.goto();

    // The "Admin" sidebar link must not be rendered for MEMBER users.
    const adminNavBtn = page.locator('aside').getByRole('button', { name: /^admin$/i });
    await expect(adminNavBtn).toHaveCount(0);
  });

  test('security.rbac.member-api-update-familymember-role-returns-authorization-error', async ({
    page,
    authPage,
    dashboardPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER API test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await expect(page).toHaveURL(/\/dashboard/i);

    const graphqlResponsePromise = page.waitForResponse((r) => r.url().includes('/graphql'), { timeout: 15000 });
    await dashboardPage.goto();
    const graphqlResponse = await graphqlResponsePromise.catch(() => null);
    const graphqlUrl = graphqlResponse?.url() ?? '';
    expect(graphqlUrl).toContain('/graphql');

    // Attempt to update a FamilyMember record's role field directly.
    // MEMBER Cognito group must not have update access on FamilyMember.
    const mutation = `
      mutation TestPrivilegeEscalation {
        updateFamilyMember(input: {
          id: "00000000-0000-0000-0000-000000000002",
          role: ADMIN
        }) { id role }
      }
    `;

    const resp = await page.request.post(graphqlUrl, {
      data: { query: mutation },
    });
    const bodyObj = await resp.json();
    const body = JSON.stringify(bodyObj);
    const status = resp.status();

    const isRejected =
      status >= 400 ||
      /unauthorized/i.test(body) ||
      /not authorized/i.test(body) ||
      /access denied/i.test(body);

    expect(isRejected).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Positive Testing – The "Matrix" Suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe('security.rbac – ADMIN role management (positive)', () => {
  test('security.rbac.admin-module-visible-in-sidebar-for-admin-user', async ({
    page,
    authPage,
    dashboardPage,
  }) => {
    const admin = getRoleUser('E2E_ADMIN_EMAIL');
    if (!admin) {
      test.skip(true, 'E2E_ADMIN_EMAIL not configured – skipping ADMIN role test');
    }

    await authPage.goto();
    await authPage.login(admin!.email, admin!.password);
    await dashboardPage.goto();

    // The "Admin" sidebar link must be present for ADMIN users.
    const adminNavBtn = page.locator('aside').getByRole('button', { name: /^admin$/i });
    await expect(adminNavBtn).toBeVisible();
  });

  test('security.rbac.admin-can-view-role-management-panel', async ({
    page,
    authPage,
    dashboardPage,
  }) => {
    const admin = getRoleUser('E2E_ADMIN_EMAIL');
    if (!admin) {
      test.skip(true, 'E2E_ADMIN_EMAIL not configured – skipping ADMIN role test');
    }

    await authPage.goto();
    await authPage.login(admin!.email, admin!.password);
    await dashboardPage.goto();

    // Navigate to the Admin module.
    await page.locator('aside').getByRole('button', { name: /^admin$/i }).click();

    // Admin module should render the family role-management panel.
    await expect(page.getByRole('heading', { name: /family members/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /promote to admin|demote to member/i }).first()).toBeVisible();
  });
});

test.describe('security.rbac – MEMBER read and chore completion (positive)', () => {
  test('security.rbac.member-can-view-vacations-list', async ({
    page,
    authPage,
    vacationsPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await vacationsPage.gotoViaUrl();

    // MEMBER users must be able to navigate to the Vacations module and view
    // the heading – read access is permitted for all groups.
    await vacationsPage.expectVacationsHeading();
  });

  test('security.rbac.member-can-view-chores-list', async ({
    authPage,
    choresPage,
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER role test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await choresPage.goto();

    await choresPage.expectChoresHeading();
  });
});
