# Backlog: Assignments Tab Does Not Refresh After Assigning a Chore

**Type:** Backlog / Product Bug  
**Component:** `src/components/modules/ChoresModule.tsx`  
**Related Test:** `e2e/tests/chores.spec.ts` — "Chore - Assign a chore to a family member"  
**Reported:** 2026-03-27

---

## Problem

After a user assigns a chore via the Assign modal and clicks **Assign**, the modal closes and a success state is implied — but the **Assignments tab does not update** to show the new assignment. The user must manually refresh the page and navigate back to the Chores module before the assignment appears.

This breaks the expected UX: a user completing an assign action expects immediate visual confirmation in the Assignments list.

---

## Expected Behavior

1. User opens Assign modal from the Chore list.
2. User selects a family member and clicks **Assign**.
3. Modal closes.
4. Assignments tab is visible and **immediately reflects the new assignment** — no page reload required.

---

## Actual Behavior

1–3 same as above.
4. Assignments tab still shows pre-assign state.
5. User must reload the page and re-navigate to see the assignment.

---

## Root Cause (Suspected)

The `handleAssignSubmit` handler in `ChoresModule.tsx` calls `ChoreAssignment.create()` and closes the modal, but does **not** re-fetch or update the local assignments state afterward. The Assignments tab is driven by stale in-memory state.

---

## Acceptance Criteria

- [ ] After a successful `ChoreAssignment.create()` call, the assignments list state is refreshed (re-fetch or optimistic update).
- [ ] The Assignments tab reflects the new assignment immediately after the modal closes — no reload required.
- [ ] A success toast or inline confirmation is shown after a successful assign.
- [ ] The E2E test is updated to remove the `page.reload()` / `choresPage.goto()` workaround (see test note below).

---

## Implementation Notes

In `ChoresModule.tsx`, locate the `handleAssignSubmit` (or equivalent) function and call `fetchAssignments()` (or re-query `ChoreAssignment.list()`) after a successful create:

```typescript
// After successful ChoreAssignment.create(...)
await fetchAssignments(); // re-fetch so Assignments tab reflects new data
setAssignModalOpen(false);
showSuccessToast('Chore assigned successfully.');
```

---

## E2E Test Workaround (to remove when fixed)

`e2e/tests/chores.spec.ts` currently contains a workaround comment and reload:

```typescript
// Current app behavior: assignment persists, but Assignments view does not
// reflect it until a refresh. Reproduce user flow exactly.
await choresPage.page.reload();
await choresPage.goto();
```

**When this backlog item is resolved**, remove the reload workaround and update the test to assert the Assignments tab updates immediately after `assignChore()` returns:

```typescript
await choresPage.assignChore(title, { assignedTo });
// After fix: no reload needed
await choresPage.switchToAssignments();
await expect(choresPage.getAssignmentRow(title)).toBeVisible();
await expect(choresPage.getAssignmentRow(title).getByText(assignedTo)).toBeVisible();
```

---

## Related Tickets

- `docs/bugs/assign-chore-no-confirmation-and-weak-assignee-input.md` — broader assign UX issues (no success toast, free-text assignee)
