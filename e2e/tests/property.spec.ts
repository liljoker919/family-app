import { expect } from '@playwright/test';
import { test } from '../fixtures/test';
import { getAnyConfiguredFamilyUser } from '../fixtures/authUsers';

const SKIP_REASON = 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.';

function uniquePropertyName(base: string): string {
  return `${base}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test.describe('Property', () => {
  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Property - Add a property with a valid name', async ({ propertyPage, loginAs }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const propertyName = uniquePropertyName('Sunset Villa');

    await loginAs();
    await propertyPage.goto();

    await propertyPage.createProperty({
      name: propertyName,
      address: '123 Ocean Drive, Miami, FL',
    });

    // The new property card should appear in the list
    await expect(propertyPage.getPropertyCard(propertyName)).toBeVisible();

    // Summary bar should show Total Income, Total Expenses, and Net Income all at zero
    await expect(propertyPage.getIncomeTotal(propertyName)).toHaveText('$0.00');
    await expect(propertyPage.getExpensesTotal(propertyName)).toHaveText('$0.00');
    await expect(propertyPage.getNetIncome(propertyName)).toHaveText('+$0.00');
  });

  test('Property - Add property form is blocked when the required name field is missing', async ({
    propertyPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await propertyPage.goto();

    // Open the Add Property form
    await propertyPage.addPropertyBtn.click();

    // Leave the required Name field empty; optionally fill address
    await propertyPage.propertyAddressInput.fill('456 Maple Street');

    // Attempt to submit – HTML5 validation should block the submission
    await propertyPage.createPropertyBtn.click();

    // The modal must remain open because the Name field is required
    await expect(propertyPage.addPropertyModalHeading).toBeVisible();
  });

  test('Property - Deleting a property removes it from the list', async ({
    propertyPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const propertyName = uniquePropertyName('Elm Street Rental');

    await loginAs();
    await propertyPage.goto();

    // Create a property so there is at least one to delete
    await propertyPage.createProperty({ name: propertyName });
    await expect(propertyPage.getPropertyCard(propertyName)).toBeVisible();

    // Delete the property and confirm the browser dialog
    await propertyPage.deleteProperty(propertyName);

    // The property and all of its associated transactions are removed from the list
    await expect(propertyPage.getPropertyCard(propertyName)).not.toBeVisible();
  });

  test('Property - Logging a rent income transaction updates the income total', async ({
    propertyPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const propertyName = uniquePropertyName('Beachside Cottage');

    await loginAs();
    await propertyPage.goto();

    // Create a property to log a transaction against
    await propertyPage.createProperty({ name: propertyName });
    await expect(propertyPage.getPropertyCard(propertyName)).toBeVisible();

    // Expand the ledger then log a Rent Income transaction
    await propertyPage.expandLedger(propertyName);
    const today = new Date().toISOString().split('T')[0];
    await propertyPage.logTransaction(propertyName, {
      category: 'RENT_INCOME',
      amount: '1500',
      date: today,
    });

    // The transaction should appear in the ledger with a green income badge
    // (the ledger remains expanded after logging the transaction)
    const card = propertyPage.getPropertyCard(propertyName);
    await expect(card.getByText('Rent Income')).toBeVisible();
    await expect(card.locator('span.text-green-600', { hasText: '+$1500.00' })).toBeVisible();

    // Total Income in the summary bar should reflect the entered amount
    await expect(propertyPage.getIncomeTotal(propertyName)).toHaveText('$1500.00');
  });

  test('Property - Logging a mortgage expense updates the expense total', async ({
    propertyPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const propertyName = uniquePropertyName('Downtown Loft');

    await loginAs();
    await propertyPage.goto();

    // Create a property to log a transaction against
    await propertyPage.createProperty({ name: propertyName });
    await expect(propertyPage.getPropertyCard(propertyName)).toBeVisible();

    // Expand the ledger, open the Log Transaction modal, and verify the type
    // preview badge shows "Expense" when Mortgage is selected
    await propertyPage.expandLedger(propertyName);
    const card = propertyPage.getPropertyCard(propertyName);
    await card.getByRole('button', { name: /\+ Log Transaction/ }).click();
    await propertyPage.categorySelect.selectOption('MORTGAGE');
    await expect(propertyPage.typeBadge).toHaveText('▼ Expense');

    // Fill the remaining required fields and save
    const today = new Date().toISOString().split('T')[0];
    await propertyPage.amountInput.fill('2000');
    await propertyPage.dateInput.fill(today);
    await propertyPage.saveTransactionBtn.click();

    // The transaction should appear in the ledger with a red expense badge
    // (the ledger remains expanded after logging the transaction)
    await expect(card.getByText('Mortgage')).toBeVisible();
    await expect(card.locator('span.text-red-600', { hasText: '-$2000.00' })).toBeVisible();

    // Total Expenses in the summary bar should reflect the entered amount
    await expect(propertyPage.getExpensesTotal(propertyName)).toHaveText('$2000.00');
  });

  test('Property - Net income equals total income minus total expenses', async ({
    propertyPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    const propertyName = uniquePropertyName('Maple Grove House');

    await loginAs();
    await propertyPage.goto();

    // Create a property and log both an income and an expense transaction
    await propertyPage.createProperty({ name: propertyName });
    await expect(propertyPage.getPropertyCard(propertyName)).toBeVisible();

    const today = new Date().toISOString().split('T')[0];

    await propertyPage.expandLedger(propertyName);
    await propertyPage.logTransaction(propertyName, {
      category: 'RENT_INCOME',
      amount: '3000',
      date: today,
    });

    // The ledger remains expanded after the first transaction; log the second directly
    await propertyPage.logTransaction(propertyName, {
      category: 'MORTGAGE',
      amount: '1200',
      date: today,
    });

    // Net Income should equal Total Income ($3000) minus Total Expenses ($1200) = $1800
    await expect(propertyPage.getIncomeTotal(propertyName)).toHaveText('$3000.00');
    await expect(propertyPage.getExpensesTotal(propertyName)).toHaveText('$1200.00');
    // Positive net income is displayed in royal blue with a "+" prefix
    await expect(propertyPage.getNetIncome(propertyName)).toHaveText('+$1800.00');

    // Verify colour – the Net Income cell uses bg-royal-blue-50 when net >= 0
    const card = propertyPage.getPropertyCard(propertyName);
    await expect(card.locator('p.text-xs', { hasText: /Net Income/i }).locator('+ p')).toHaveClass(
      /text-royal-blue-700/
    );
  });
});
