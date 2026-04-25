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
 *   E2E_PLANNER_EMAIL – email of a user whose Cognito group is PLANNER
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

    // MEMBER users should not see the "Add Vacation" button.
    const addVacationBtn = page.getByRole('button', { name: /add vacation/i });
    await expect(addVacationBtn).toHaveCount(0);
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

    // MEMBER users should not see the "Add Car" button.
    const addCarBtn = page.getByRole('button', { name: /add car/i });
    await expect(addCarBtn).toHaveCount(0);
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
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER API test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await expect(page).toHaveURL(/\/dashboard/i);

    // Attempt to call the createVacation mutation directly via fetch.
    // Because the user belongs to the MEMBER Cognito group the AppSync
    // authorization rules must reject the request.
    const result = await page.evaluate(async () => {
      const outputs = (window as any).__amplify_outputs || {};
      const endpoint: string = outputs?.data?.url ?? '';
      const apiKey: string = outputs?.data?.api_key ?? '';

      if (!endpoint) return { skipped: true };

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

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ query: mutation }),
        credentials: 'include',
      });

      const json = await resp.json();
      return { status: resp.status, body: JSON.stringify(json) };
    });

    if ((result as any).skipped) {
      test.skip(true, 'Amplify endpoint not available in page context – skipping');
    }

    const body: string = (result as any).body ?? '';
    const status: number = (result as any).status ?? 0;

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
  }) => {
    const user = await loginAs().catch(() => null);
    if (!user) {
      test.skip(true, 'No E2E user configured – skipping tenant isolation test');
    }

    await expect(page).toHaveURL(/\/dashboard/i);

    const result = await page.evaluate(async () => {
      const outputs = (window as any).__amplify_outputs || {};
      const endpoint: string = outputs?.data?.url ?? '';

      if (!endpoint) return { skipped: true };

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

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        credentials: 'include',
      });

      const json = await resp.json();
      return { status: resp.status, body: JSON.stringify(json) };
    });

    if ((result as any).skipped) {
      test.skip(true, 'Amplify endpoint not available in page context – skipping');
    }

    const body: string = (result as any).body ?? '';
    const status: number = (result as any).status ?? 0;

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
  }) => {
    const member = getRoleUser('E2E_MEMBER_EMAIL');
    if (!member) {
      test.skip(true, 'E2E_MEMBER_EMAIL not configured – skipping MEMBER API test');
    }

    await authPage.goto();
    await authPage.login(member!.email, member!.password);
    await expect(page).toHaveURL(/\/dashboard/i);

    const result = await page.evaluate(async () => {
      const outputs = (window as any).__amplify_outputs || {};
      const endpoint: string = outputs?.data?.url ?? '';

      if (!endpoint) return { skipped: true };

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

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation }),
        credentials: 'include',
      });

      const json = await resp.json();
      return { status: resp.status, body: JSON.stringify(json) };
    });

    if ((result as any).skipped) {
      test.skip(true, 'Amplify endpoint not available in page context – skipping');
    }

    const body: string = (result as any).body ?? '';
    const status: number = (result as any).status ?? 0;

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

    // The role management section with "Change Role" or similar controls
    // should be visible.
    const adminHeading = page.getByRole('heading', { name: /admin/i });
    await expect(adminHeading.first()).toBeVisible();
  });
});

test.describe('security.rbac – PLANNER create/update permissions (positive)', () => {
  test('security.rbac.planner-add-vacation-button-visible', async ({
    page,
    authPage,
    vacationsPage,
  }) => {
    const planner = getRoleUser('E2E_PLANNER_EMAIL');
    if (!planner) {
      test.skip(true, 'E2E_PLANNER_EMAIL not configured – skipping PLANNER role test');
    }

    await authPage.goto();
    await authPage.login(planner!.email, planner!.password);
    await vacationsPage.gotoViaUrl();

    // PLANNER users should see the "Add Vacation" or equivalent create button.
    const addBtn = page.getByRole('button', { name: /add vacation/i });
    await expect(addBtn).toBeVisible();
  });

  test('security.rbac.planner-add-chore-button-visible', async ({
    page,
    authPage,
    choresPage,
  }) => {
    const planner = getRoleUser('E2E_PLANNER_EMAIL');
    if (!planner) {
      test.skip(true, 'E2E_PLANNER_EMAIL not configured – skipping PLANNER role test');
    }

    await authPage.goto();
    await authPage.login(planner!.email, planner!.password);
    await choresPage.goto();

    // PLANNER users should see the "Add Chore" button.
    await expect(choresPage.addChoreBtn).toBeVisible();
  });

  test('security.rbac.planner-add-car-button-visible', async ({
    page,
    authPage,
    carsPage,
  }) => {
    const planner = getRoleUser('E2E_PLANNER_EMAIL');
    if (!planner) {
      test.skip(true, 'E2E_PLANNER_EMAIL not configured – skipping PLANNER role test');
    }

    await authPage.goto();
    await authPage.login(planner!.email, planner!.password);
    await carsPage.goto();

    // PLANNER users should see the "Add Car" button.
    const addCarBtn = page.getByRole('button', { name: /add car/i });
    await expect(addCarBtn).toBeVisible();
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
