# Family App – Launch Checklist

> **Purpose:** This document defines the formal pass/fail criteria, rollback strategy, and Family Beta dry-run sign-off required before any production release.

---

## Table of Contents

1. [Pass / Fail Criteria](#1-pass--fail-criteria)
2. [Rollback Plan](#2-rollback-plan)
3. [Family Beta Dry-Run](#3-family-beta-dry-run)
4. [Deployment Policy](#4-deployment-policy)

---

## 1. Pass / Fail Criteria

A release is **approved** only when every item below is checked off by the responsible party.

### 1.1 Security Regressions (Tenant Isolation / RBAC)

| # | Check | Required Result | Status |
|---|-------|----------------|--------|
| SR-1 | All Vitest RBAC unit tests pass (`security.rbac.test.ts`) | 100 % pass rate | ☐ |
| SR-2 | All Vitest schema static-analysis tests pass (`security.schema.test.ts`) | 100 % pass rate | ☐ |
| SR-3 | Security E2E suite passes in the staging environment (`security.spec.ts`) | 0 failures | ☐ |
| SR-4 | Cross-family data access is impossible for all three roles (ADMIN / PLANNER / MEMBER) | No security leaks | ☐ |
| SR-5 | `familyId` filter is enforced on all family-scoped models in AppSync | Confirmed in schema | ☐ |

### 1.2 Critical Flows – Chores & Vacations

| # | Check | Required Result | Status |
|---|-------|----------------|--------|
| CF-1 | Admin can create, edit, and delete a Chore | Pass | ☐ |
| CF-2 | Planner can create and edit a Chore but **cannot** delete | Pass | ☐ |
| CF-3 | Member can view and mark a Chore complete but **cannot** create or delete | Pass | ☐ |
| CF-4 | Admin can create, edit, and delete a Vacation | Pass | ☐ |
| CF-5 | Planner can create and edit a Vacation but **cannot** delete | Pass | ☐ |
| CF-6 | Member can view a Vacation but **cannot** create, edit, or delete | Pass | ☐ |
| CF-7 | Zero high-priority bugs open in the Chores or Vacations critical flows | 0 open bugs | ☐ |

### 1.3 Trust Breaker Workarounds

| # | Check | Required Result | Status |
|---|-------|----------------|--------|
| TB-1 | No reload workarounds remain in the codebase (`grep -r "window.location.reload"`) | 0 matches | ☐ |
| TB-2 | No `TODO: remove` / `FIXME: reload` comments referencing UI stalls | 0 matches | ☐ |

---

## 2. Rollback Plan

### 2.1 Frontend – Revert Amplify Hosting to Last Successful Build

If a production deployment is found to be broken, the Amplify hosting can be rolled back to the previous successful build using the AWS CLI:

```bash
# 1. List recent deployments for your Amplify app.
aws amplify list-jobs \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --max-results 5

# 2. Identify the last known-good Job ID from the list above (status = SUCCEED).
# 3. Start a re-deployment of that specific job.
aws amplify start-job \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --job-type RETRY \
  --job-id <LAST_GOOD_JOB_ID>
```

> Replace `<AMPLIFY_APP_ID>` with the value from the Amplify console (e.g. `d1gak7oijss0a0`) and `<LAST_GOOD_JOB_ID>` with the numeric job identifier of the last green build.

Alternatively, from the **Amplify Console**:

1. Open **AWS Amplify Console** → select the **family-app** app.
2. Click the **main** branch → **Build history**.
3. Locate the last green (✅) build and click **Redeploy this version**.

### 2.2 Backend – Database Schema Migrations

#### Point of No Return

A database schema migration becomes **irreversible** at the moment the `npx ampx deploy` command completes successfully and DynamoDB table definitions (GSIs, key schemas) are updated in production.

**Before crossing this threshold:**

- Export a snapshot of all DynamoDB tables used by the app (use AWS Backup or `dynamodb:ExportTableToPointInTime`).
- Tag the pre-migration Amplify backend deployment ID in the console or in a release note.

#### Rollback Steps (before Point of No Return)

```bash
# Revert to the last known-good backend deployment by re-deploying
# the previously committed amplify/data/resource.ts.
git revert <migration-commit-sha>
npx ampx deploy
```

#### Rollback Steps (after Point of No Return – data migration required)

1. Restore DynamoDB tables from the pre-migration AWS Backup snapshot.
2. Revert the `amplify/data/resource.ts` changes and redeploy the backend.
3. Validate data integrity with a full smoke test before re-enabling traffic.

> ⚠️ After crossing the Point of No Return, contact the team lead before attempting any rollback. Data loss is possible.

---

## 3. Family Beta Dry-Run

### 3.1 Seeded Accounts

The following accounts must be created in the staging Cognito User Pool before beginning the dry-run. Each account belongs to the stated Cognito group and represents a distinct RBAC persona.

| Persona | Cognito Username | Email Pattern | Cognito Group | Notes |
|---------|-----------------|---------------|---------------|-------|
| Admin_Dad | `admin_dad` | `admin_dad@<family-domain>` | `ADMIN` | Full CRUD on all models |
| Planner_Mom | `planner_mom` | `planner_mom@<family-domain>` | `PLANNER` | Create/read/update; no delete |
| Member_Kid | `member_kid` | `member_kid@<family-domain>` | `MEMBER` | Read-only (limited actions) |

> Accounts should share the same `familyId` so that cross-role data access can be verified. A second isolated family (e.g. `outsider_admin`) should also be created to verify **tenant isolation** (cross-family data access is blocked).

### 3.2 Dry-Run Execution Checklist

Perform the following walkthrough end-to-end using the seeded accounts in the staging environment.

#### Family Code / Join Flow

| Step | Actor | Action | Expected Result | Pass / Fail |
|------|-------|--------|----------------|-------------|
| JF-1 | Admin_Dad | Create a new family and copy the Family Code | Family Code generated and displayed | ☐ |
| JF-2 | Planner_Mom | Enter the Family Code on the join screen | Successfully joins the family | ☐ |
| JF-3 | Member_Kid | Enter the Family Code on the join screen | Successfully joins the family | ☐ |
| JF-4 | outsider_admin | Attempt to access data belonging to the first family | Access denied / no data returned | ☐ |

#### RBAC Boundary Verification

| Step | Actor | Action | Expected Result | Pass / Fail |
|------|-------|--------|----------------|-------------|
| RB-1 | Admin_Dad | Create a Vacation, a Chore, and a Car | All items created successfully | ☐ |
| RB-2 | Planner_Mom | Edit the Vacation created by Admin_Dad | Edit succeeds | ☐ |
| RB-3 | Planner_Mom | Attempt to delete the Vacation | Action blocked (no delete button / 403) | ☐ |
| RB-4 | Member_Kid | View the Vacation and Chore | Items visible | ☐ |
| RB-5 | Member_Kid | Attempt to create a new Vacation | Action blocked (no create button / 403) | ☐ |
| RB-6 | Member_Kid | Attempt to edit an existing Chore description | Action blocked | ☐ |
| RB-7 | Admin_Dad | Delete the Chore | Deletion succeeds | ☐ |
| RB-8 | outsider_admin | Query for Vacations / Chores of the first family | 0 results returned | ☐ |

### 3.3 Beta Sign-off

| Sign-off Item | Responsible Party | Date | Status |
|--------------|-------------------|------|--------|
| All dry-run steps above completed with 0 security leaks | QA Lead | | ☐ |
| No UI stalls or reload workarounds observed during walkthrough | Frontend Lead | | ☐ |
| Amplify deployment triggered only after all Required Checks passed | DevOps Lead | | ☐ |
| LAUNCH_CHECKLIST reviewed and all items checked | Product Owner | | ☐ |

---

## 4. Deployment Policy

### 4.1 Required GitHub Checks (Branch Protection)

The following GitHub Actions workflows are configured as **Required Status Checks** for the `main` branch. A Pull Request **cannot** be merged until all of these pass:

| Workflow | Job Name | Failure Action |
|----------|----------|----------------|
| **Security Regression Suite** | `Security Unit & Schema Tests (Vitest)` | ❌ Block merge |
| **Security Regression Suite** | `Security E2E Tests (Playwright)` | ❌ Block merge |
| **Unit Tests** | `Run Unit Tests` | ❌ Block merge |
| **Playwright E2E Tests** | `Run Playwright E2E Tests` | ❌ Block merge |

> Branch protection settings are configured in **GitHub → Settings → Branches → Branch protection rules → main**.

### 4.2 Amplify Build Trigger Policy

The Amplify build for the `main` branch is configured to trigger **only after** the GitHub Actions Required Checks return a success status. This is enforced by:

1. Disabling **Auto-build** in the Amplify Console for the `main` branch.
2. Using the [Amplify GitHub App](https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html) deployment protection rules so that Amplify waits for the `required_status_checks` to pass before starting a build.

> To verify: Go to **Amplify Console → App settings → Build settings** and confirm that "Deploy on push" is gated by the GitHub Required Checks.
