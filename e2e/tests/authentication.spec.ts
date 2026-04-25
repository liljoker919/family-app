import { test, expect } from '../fixtures/test';
import { getAnyConfiguredFamilyUser, INVALID_PASSWORD } from '../fixtures/authUsers';

const MISSING_USER_MESSAGE = 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.';

function uniqueSignupEmail(): string {
  return `family-app-e2e-${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}

test.describe('Authentication', () => {
  test('Authentication - Sign in with valid credentials', async ({ authPage, loginAs }) => {
    await loginAs('dad');
    await authPage.expectSignedIn();
  });

  test.fixme('Authentication - Sign up with valid new user credentials', async ({ authPage }) => {
    await authPage.goto();
    await authPage.openCreateAccount();

    await authPage.signUp({
      email: uniqueSignupEmail(),
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
      firstName: 'E2E',
      lastName: 'User',
    });

    // Draft coverage only: enable after asserting the post-signup confirmation
    // state for Cognito in this environment.
  });

  test.fixme('Authentication - Sign up with mismatched password', async ({ authPage }) => {
    await authPage.goto();
    await authPage.openCreateAccount();

    await authPage.signUp({
      email: uniqueSignupEmail(),
      password: 'ValidPassword123!',
      confirmPassword: 'DifferentPassword123!',
      firstName: 'Mismatch',
      lastName: 'User',
    });

    // Draft coverage only: enable after asserting the exact validation message
    // emitted by the Authenticator for password mismatch.
  });

  test('Authentication - Sign in with an incorrect password', async ({ page, authPage }) => {
    const user = getAnyConfiguredFamilyUser();
    if (!user) {
      throw new Error(MISSING_USER_MESSAGE);
    }

    await authPage.goto();
    await authPage.login(user.email, INVALID_PASSWORD);

    // Invalid credentials should keep the user on the auth form.
    await authPage.expectOnSignInForm();
    await expect(page).not.toHaveURL(/\/dashboard/i);
  });

  test('Authentication - Sign out from the dashboard', async ({ authPage, loginAs }) => {
    await loginAs('dad');
    await authPage.expectSignedIn();
    await authPage.signOut();
  });
});