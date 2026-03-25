import { expect, type Locator, type Page } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.signInButton = page.getByRole('button', { name: /^sign in$/i });
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.emailInput).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectOnSignInForm() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  async expectSignedIn() {
    await expect(this.page).toHaveURL(/\/dashboard/i);
    await expect(this.page.getByRole('button', { name: /sign out/i })).toBeVisible();
  }

  async signOut() {
    await this.page.getByRole('button', { name: /sign out/i }).click();
    await this.expectOnSignInForm();
  }
}