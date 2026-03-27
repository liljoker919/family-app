# Ticket: Standardize Auth Patterns Across App

## Summary
The app currently mixes two authorization patterns:
- backend schema rules based on Cognito groups (`ADMIN`, `PLANNER`)
- frontend/business logic based on `FamilyMember.role`

This mismatch already caused chore creation to fail and creates risk that similar failures still exist in other modules.

## Problem
Roles in the app are managed through the `FamilyMember` model, not through Cognito group membership. Any schema model that relies on Cognito group rules can drift out of sync with the role model the UI actually uses.

## Why This Follow-Up Is Needed
PR #84 fixed chores by replacing non-functional group-based auth with authenticated access, but other models in the schema still use mixed patterns. Without a consistent auth strategy, similar bugs can recur in other features.

## Scope
Audit and standardize authorization across:
- Amplify schema model auth rules
- frontend role gating
- API write/read expectations
- family-level scoping expectations

## Suggested Investigation
1. Inventory every `.authorization(...)` block in `amplify/data/resource.ts`.
2. Identify which models rely on Cognito groups versus authenticated/owner rules.
3. Compare each backend rule with the corresponding frontend role checks.
4. Decide on one consistent app-wide auth pattern.
5. Verify that family-level role management and backend enforcement align.
6. Add regression coverage for create/update/delete flows in protected modules.

## Candidate Areas To Review
- Family / FamilyMember / Profile
- Vacation planning models
- Trip planning models
- Property models
- Recipe/Cookbook models
- Car / CarService models
- Chore / ChoreAssignment / ChoreCompletion models

## Desired Outcome
- One clear authorization strategy across the app
- No dependency on unused Cognito group state unless the app explicitly provisions and synchronizes those groups
- Frontend role checks and backend authorization rules enforce the same access model
- Regression tests cover representative protected flows
