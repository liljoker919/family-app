import { test, expect } from '../fixtures/test';
import { getAnyConfiguredFamilyUser, INVALID_PASSWORD } from '../fixtures/authUsers';

test.describe('Authentication', () => {
  test('Authentication - Sign in with valid credentials', async ({ authPage, loginAs }) => {
    test.skip(!getAnyConfiguredFamilyUser(), 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.');

    await loginAs('dad');
    await authPage.expectSignedIn();
  });

  test('Authentication - Sign in with an incorrect password', async ({ page, authPage }) => {
    const user = getAnyConfiguredFamilyUser();
    test.skip(!user, 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.');

    await authPage.goto();
    await authPage.login(user!.email, INVALID_PASSWORD);

    // Invalid credentials should keep the user on the auth form.
    await authPage.expectOnSignInForm();
    await expect(page).not.toHaveURL(/\/dashboard/i);
  });

  test('Authentication - Sign out from the dashboard', async ({ authPage, loginAs }) => {
    test.skip(!getAnyConfiguredFamilyUser(), 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.');

    await loginAs('dad');
    await authPage.expectSignedIn();
    await authPage.signOut();
  });
});