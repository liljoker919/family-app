# Bug/Feature: Assign Chore Has No Confirmation and Weak Assignee UX

## Summary
Assign Chore currently appears to do little from a user perspective: the modal closes after submit, but there is no clear success confirmation, and assignee selection relies on a free-text field that may not match known family members consistently.

## Current Behavior
- "Assign To" is a plain text input.
- User can type arbitrary values.
- On submit, modal closes with no explicit success message.
- Assignment list visibility/refresh is not obvious to users immediately after submit.

## Why This Is Risky
- Users cannot tell if assignment succeeded.
- Typos/mismatched names can create inconsistent assignment records.
- Creates confusion and repeated submissions.

## Reproduction
1. Sign in as an admin/planner user.
2. Open Chores > All Chores.
3. Click Assign on a chore.
4. Enter assignee text and click Assign.
5. Observe modal closes without explicit success feedback.

## Expected
- Clear success confirmation after assignment.
- Assignee selection constrained to valid family members.
- Assignment list updates immediately after save.

## Suggested UI/Workflow Update (Feature)
1. Replace free-text "Assign To" with a dropdown/select populated from family members.
2. Store a stable identifier (member ID/user ID) alongside display name.
3. Show success toast/banner: "Chore assigned to <name>."
4. Automatically switch to Assignments tab (or show inline confirmation with quick link).
5. Refresh assignment data immediately after successful create.

## Technical Notes
- In `ChoresModule`, `handleAssignSubmit` currently closes modal but does not call assignment refresh.
- Add explicit fetch/update after create and visible user feedback state.

## Test Alignment
- Update E2E assignment test data to use known family member values (`Child1`/`Child2`) rather than arbitrary text.
