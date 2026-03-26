import { test as base, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { VacationsPage } from '../pages/VacationsPage';
import { getAnyConfiguredFamilyUser, getConfiguredFamilyUsers, getFamilyUser, type FamilyRole } from './authUsers';

type AuthFixtures = {
  authPage: AuthPage;
  vacationsPage: VacationsPage;
  loginAs: (role?: FamilyRole) => Promise<{ role: FamilyRole; email: string }>;
  configuredRoles: FamilyRole[];
};

export const test = base.extend<AuthFixtures>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },

  vacationsPage: async ({ page }, use) => {
    await use(new VacationsPage(page));
  },

  configuredRoles: async ({}, use) => {
    const roles = getConfiguredFamilyUsers().map((user) => user.role);
    await use(roles);
  },

  loginAs: async ({ authPage }, use) => {
    await use(async (role?: FamilyRole) => {
      const user = role ? getFamilyUser(role) : getAnyConfiguredFamilyUser();
      if (!user) {
        throw new Error(
          'No valid E2E family test user configured. Set E2E_VALID_PASSWORD and one of: E2E_DAD_EMAIL, E2E_MOM_EMAIL, E2E_CHILD1_EMAIL, E2E_CHILD2_EMAIL.'
        );
      }

      await authPage.goto();
      await authPage.login(user.email, user.password);
      return { role: user.role, email: user.email };
    });
  },
});

export { expect };