import { expect, type Locator, type Page } from '@playwright/test';

export interface SignUpDetails {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly createAccountTab: Locator;
  readonly signUpEmailInput: Locator;
  readonly signUpPasswordInput: Locator;
  readonly signUpConfirmPasswordInput: Locator;
  readonly signUpFirstNameInput: Locator;
  readonly signUpLastNameInput: Locator;
  readonly createAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.signInButton = page.getByRole('button', { name: /^sign in$/i });
    this.createAccountTab = page.locator('button').filter({ hasText: /^Create Account$/ }).first();
    this.signUpEmailInput = page.locator('input[name="email"]:visible');
    this.signUpPasswordInput = page.locator('input[name="password"]:visible');
    this.signUpConfirmPasswordInput = page.locator('input[name="confirm_password"]:visible');
    this.signUpFirstNameInput = page.locator('input[name="given_name"]:visible');
    this.signUpLastNameInput = page.locator('input[name="family_name"]:visible');
    this.createAccountButton = page.locator('form').getByRole('button', { name: /^create account$/i });
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

  async openCreateAccount() {
    await this.createAccountTab.click();
    await this.expectOnSignUpForm();
  }

  async signUp(details: SignUpDetails) {
    await this.signUpEmailInput.fill(details.email);
    await this.signUpPasswordInput.fill(details.password);
    await this.signUpConfirmPasswordInput.fill(details.confirmPassword);
    await this.signUpFirstNameInput.fill(details.firstName);
    await this.signUpLastNameInput.fill(details.lastName);
    await this.createAccountButton.click();
  }

  async expectOnSignInForm() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  async expectOnSignUpForm() {
    await expect(this.signUpEmailInput).toBeVisible();
    await expect(this.signUpPasswordInput).toBeVisible();
    await expect(this.signUpConfirmPasswordInput).toBeVisible();
    await expect(this.signUpFirstNameInput).toBeVisible();
    await expect(this.signUpLastNameInput).toBeVisible();
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