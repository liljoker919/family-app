import { expect } from '@playwright/test';
import { test } from '../fixtures/test';

function uniqueTitle(base: string): string {
  return `${base}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test.describe('Chores', () => {
  // ── BrowserStack-mapped test cases ───────────────────────────────────────

  test('Chore - Create a new chore with title and recurrence', async ({
    choresPage,
    loginAs,
  }) => {
    const title = uniqueTitle('Vacuum Living Room');

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    await choresPage.createChore({
      title,
      category: 'CLEANING',
      recurrence: 'WEEKLY',
    });

    // The new chore appears in the chore list with the entered title,
    // category, and recurrence label
    const choreRow = choresPage.getChoreRow(title);
    await expect(choreRow).toBeVisible();
    await expect(choreRow.getByText('Weekly')).toBeVisible();
    await expect(choreRow.getByText('Cleaning')).toBeVisible();

    // cleanup
    await choresPage.deleteChore(title).catch(() => undefined);
  });

  test('Chore - Assign a chore to a family member', async ({
    choresPage,
    loginAs,
  }) => {
    const title = uniqueTitle('Walk the Dog');
    const assignedTo = 'Child1';

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore so there is at least one to assign
    await choresPage.createChore({
      title,
      category: 'PETS',
      recurrence: 'DAILY',
    });

    await expect(choresPage.getChoreRow(title)).toBeVisible();

    // Open the assign form, select a family member, and click Assign
    await choresPage.assignChore(title, { assignedTo });

    // Switch to Assignments tab and verify the chore is listed as assigned
    await choresPage.switchToAssignments();
    await expect(choresPage.getAssignmentRow(title)).toBeVisible();
    await expect(
      choresPage.getAssignmentRow(title).getByText(assignedTo)
    ).toBeVisible();

    // cleanup
    await choresPage.switchToAllChores();
    await choresPage.deleteChore(title).catch(() => undefined);
  });

  test('Chore - Deleting a chore removes it from the list', async ({
    choresPage,
    loginAs,
  }) => {
    const title = uniqueTitle('Take Out Trash');

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore so there is at least one to delete
    await choresPage.createChore({
      title,
      category: 'ERRANDS',
      recurrence: 'WEEKLY',
    });

    await expect(choresPage.getChoreRow(title)).toBeVisible();

    // Delete the chore and confirm the browser dialog
    await choresPage.deleteChore(title);

    // The chore is permanently removed from the chore list
    await expect(choresPage.getChoreRow(title)).not.toBeVisible();
  });

  test('Chore - Edit an existing chore updates its details', async ({
    choresPage,
    loginAs,
  }) => {
    const originalTitle = uniqueTitle('Mop Kitchen Floor');
    const updatedTitle = uniqueTitle('Mop All Floors');

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore to edit
    await choresPage.createChore({
      title: originalTitle,
      category: 'CLEANING',
      recurrence: 'WEEKLY',
      pointValue: '5',
    });

    await expect(choresPage.getChoreRow(originalTitle)).toBeVisible();

    // Edit the chore: update title and point value
    await choresPage.editChore(originalTitle, {
      title: updatedTitle,
      pointValue: '15',
    });

    // The chore list reflects the updated title and point value
    await expect(choresPage.getChoreRow(updatedTitle)).toBeVisible();
    await expect(
      choresPage.getChoreRow(updatedTitle).getByText('15 pts')
    ).toBeVisible();

    // cleanup
    await choresPage.deleteChore(updatedTitle).catch(() => undefined);
  });

  test('Chore - Mark a chore as complete', async ({
    choresPage,
    loginAs,
  }) => {
    const title = uniqueTitle('Wash Dishes');

    await loginAs();
    await choresPage.goto();
    await choresPage.switchToAllChores();

    // Create a chore so there is at least one chore that has been assigned
    await choresPage.createChore({
      title,
      category: 'COOKING',
      recurrence: 'DAILY',
    });

    await expect(choresPage.getChoreRow(title)).toBeVisible();

    // Click the complete button for that chore and confirm the completion form
    await choresPage.logChoreCompletion(title);

    // The chore is marked as completed and a completion record appears in the
    // completion history
    await choresPage.switchToCompletionHistory();
    await expect(choresPage.getCompletionRow(title)).toBeVisible();

    // cleanup
    await choresPage.switchToAllChores();
    await choresPage.deleteChore(title).catch(() => undefined);
  });
});
