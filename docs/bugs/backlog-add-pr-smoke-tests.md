# Backlog: Add PR Smoke Test Workflow Before Merge

## Summary

Create a lightweight smoke test workflow that runs on pull requests before merge, while keeping the full Playwright UI/E2E suite on merge to `main`.

## Goal

Provide early signal on critical user journeys in PRs without the runtime/cost of the full end-to-end suite.

## Proposed Scope

- Run on `pull_request` to `main`.
- Execute a small smoke subset only (critical happy paths).
- Keep full UI/E2E test workflow on `push` to `main` and manual runs.

## Candidate Smoke Coverage

- Authentication: valid login succeeds.
- Dashboard: loads after login and core shell renders.
- One representative module path (for example, navigate to Chores or Vacations and verify heading).

## Implementation Notes

- Add a separate GitHub Actions workflow (for example, `.github/workflows/pr-smoke.yml`).
- Use Playwright grep tags or a dedicated smoke spec list.
- Ensure secrets required for smoke tests are available in PR workflow context.
- Publish HTML report and test-results artifacts for failed PR runs.

## Acceptance Criteria

1. PR smoke workflow runs automatically on every PR to `main`.
2. Smoke workflow finishes faster than full E2E suite.
3. Smoke failures are visible in PR checks before merge.
4. Full E2E workflow continues to run only on merge to `main` (plus manual dispatch).
5. Smoke workflow can be re-run manually from Actions UI.

## Priority

Medium

## Rationale

This balances fast developer feedback on PRs with comprehensive validation on merge, reducing duplicate heavy runs while still catching major regressions early.
