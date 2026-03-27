# Backlog: Standardize Create, Edit, and Delete Confirmations Across Modules

**Type:** Backlog / UX Consistency  
**Component:** Cross-module UI flows (`VacationsModule`, `ChoresModule`, `CarsModule`, `PropertyModule`, and related forms/modals)  
**Reported:** 2026-03-27

---

## Problem

Confirmation behaviors are inconsistent across the app:

- Some actions provide no explicit success feedback after create/edit.
- Some delete actions rely only on browser confirm dialogs and do not consistently reflect final state in the UI.
- Message patterns and interaction timing differ by module.

This creates uncertainty for users about whether critical actions were actually completed.

---

## Goal

Define and apply one standard confirmation pattern for create, edit, and delete actions across all modules.

---

## Proposed UX Standard

1. Create

- Show success toast/banner after successful create.
- Immediately reflect the created item in the current list/view.

2. Edit

- Show success toast/banner after successful edit.
- Immediately reflect updated values in-place.

3. Delete

- Use a consistent confirmation step before delete.
- On confirm + successful delete, remove item from UI immediately.
- Show success toast/banner after delete.
- On failure, show actionable error toast/banner and keep item visible.

4. Error handling

- Standardize API failure messages and field-level validation display.
- Prevent silent failures.

---

## Acceptance Criteria

- [ ] All create actions use the same success confirmation pattern.
- [ ] All edit actions use the same success confirmation pattern.
- [ ] All delete actions use the same confirm + success/error pattern.
- [ ] Deleted items are removed from UI without requiring page refresh.
- [ ] Confirmation copy and visual style are standardized app-wide.
- [ ] E2E tests validate confirmation behavior for create/edit/delete in each major module.

---

## Implementation Notes

- Introduce shared confirmation helpers/components (for example, a centralized toast utility and confirm dialog wrapper).
- Replace direct browser confirm usage where appropriate with a consistent app-level confirmation modal.
- Ensure each mutation handler updates local state and/or refetches relevant data after success.
- Add regression tests for:
  - create success feedback + visible new row/card
  - edit success feedback + visible updated data
  - delete confirm + item removed from list

---

## Related Context

- Current backlog: `docs/bugs/backlog-assignments-tab-does-not-refresh-after-assign.md`
- Related bug behavior seen in Vacations delete flow where item can remain visible after confirmation
