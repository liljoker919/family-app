import { expect } from '@playwright/test';
import { test } from '../fixtures/test';
import { getAnyConfiguredFamilyUser } from '../fixtures/authUsers';

const SKIP_REASON = 'Set E2E_VALID_PASSWORD and at least one E2E_*_EMAIL secret.';

test.describe('Chores', () => {
  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Chore - Create a new chore with title and recurrence', async ({
    choresPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    await choresPage.createChore({
      title: 'Vacuum Living Room',
      category: 'CLEANING',
      recurrence: 'WEEKLY',
    });

    // The new chore appears in the chore list with the entered title,
    // category, and recurrence label
    const choreRow = choresPage.getChoreRow('Vacuum Living Room');
    await expect(choreRow).toBeVisible();
    await expect(choreRow.getByText('Weekly')).toBeVisible();
    await expect(choreRow.getByText('Cleaning')).toBeVisible();
  });

  test('Chore - Assign a chore to a family member', async ({
    choresPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore so there is at least one to assign
    await choresPage.createChore({
      title: 'Walk the Dog',
      category: 'PETS',
      recurrence: 'DAILY',
    });

    await expect(choresPage.getChoreRow('Walk the Dog')).toBeVisible();

    // Open the assign form, select a family member, and click Assign
    await choresPage.assignChore('Walk the Dog', { assignedTo: 'Alex' });

    // Switch to Assignments tab and verify the chore is listed as assigned
    await choresPage.switchToAssignments();
    await expect(choresPage.getAssignmentRow('Walk the Dog')).toBeVisible();
    await expect(
      choresPage.getAssignmentRow('Walk the Dog').getByText('Alex')
    ).toBeVisible();
  });

  test('Chore - Deleting a chore removes it from the list', async ({
    choresPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore so there is at least one to delete
    await choresPage.createChore({
      title: 'Take Out Trash',
      category: 'ERRANDS',
      recurrence: 'WEEKLY',
    });

    await expect(choresPage.getChoreRow('Take Out Trash')).toBeVisible();

    // Delete the chore and confirm the browser dialog
    await choresPage.deleteChore('Take Out Trash');

    // The chore is permanently removed from the chore list
    await expect(choresPage.getChoreRow('Take Out Trash')).not.toBeVisible();
  });

  test('Chore - Edit an existing chore updates its details', async ({
    choresPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore to edit
    await choresPage.createChore({
      title: 'Mop Kitchen Floor',
      category: 'CLEANING',
      recurrence: 'WEEKLY',
      pointValue: '5',
    });

    await expect(choresPage.getChoreRow('Mop Kitchen Floor')).toBeVisible();

    // Edit the chore: update title and point value
    await choresPage.editChore('Mop Kitchen Floor', {
      title: 'Mop All Floors',
      pointValue: '15',
    });

    // The chore list reflects the updated title and point value
    await expect(choresPage.getChoreRow('Mop All Floors')).toBeVisible();
    await expect(
      choresPage.getChoreRow('Mop All Floors').getByText('15 pts')
    ).toBeVisible();
  });

  test('Chore - Mark a chore as complete', async ({
    choresPage,
    loginAs,
  }) => {
    test.skip(!getAnyConfiguredFamilyUser(), SKIP_REASON);

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore so there is at least one chore that has been assigned
    await choresPage.createChore({
      title: 'Wash Dishes',
      category: 'COOKING',
      recurrence: 'DAILY',
    });

    await expect(choresPage.getChoreRow('Wash Dishes')).toBeVisible();

    // Click the complete button for that chore and confirm the completion form
    await choresPage.logChoreCompletion('Wash Dishes');

    // The chore is marked as completed and a completion record appears in the
    // completion history
    await choresPage.switchToCompletionHistory();
    await expect(choresPage.getCompletionRow('Wash Dishes')).toBeVisible();
  });
});
