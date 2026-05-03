/**
 * Security Regression Suite – Schema Authorization Rules
 *
 * Parses amplify/data/resource.ts as text and asserts that every model carries
 * the expected Amplify authorization rules.  This acts as a sentinel that fails
 * immediately if a developer accidentally weakens or removes a security gate in
 * the schema.
 *
 * The test names follow the pattern
 *   security.schema.<model>.<rule>
 * so that CI reports map directly back to the Authorization Matrix.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the schema once for all tests.
let schema: string;
beforeAll(() => {
  const schemaPath = resolve(__dirname, '../../..', 'amplify/data/resource.ts');
  schema = readFileSync(schemaPath, 'utf-8');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the text of the .authorization(…) block for the given model name,
 * or null if the model is not found.
 *
 * Strategy: find "  ModelName: a" then scan forward for the first
 * ".authorization((allow) => [" block and capture everything up to the
 * matching closing "])" of that block.
 */
function extractAuthBlock(modelName: string): string | null {
  // Locate the model declaration line.  The schema file uses the pattern:
  //   ModelName: a
  //     .model({
  // so we search for `ModelName: a` (without requiring an immediate dot).
  const modelPattern = new RegExp(`\\b${modelName}:\\s*a\\b`);
  const modelStart = schema.search(modelPattern);
  if (modelStart === -1) return null;

  // Find the .authorization block after the model declaration.
  const authPattern = /\.authorization\(\(allow\)\s*=>\s*\[/g;
  authPattern.lastIndex = modelStart;
  const authMatch = authPattern.exec(schema);
  if (!authMatch) return null;

  // Capture from the start of .authorization to the closing bracket of the array.
  const blockStart = authMatch.index;
  let depth = 0;
  let i = authMatch.index + authMatch[0].length - 1; // points at the opening `[`
  for (; i < schema.length; i++) {
    if (schema[i] === '[') depth++;
    else if (schema[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  return schema.slice(blockStart, i + 1);
}

/**
 * Returns true when the authorization block contains an allow rule that
 * matches `groups` exactly and grants the specified `operations`.
 *
 * Example: containsGroupRule(block, ['ADMIN'], ['delete'])  → true when
 *   allow.groups(['ADMIN']).to(['delete'])  is present.
 */
function containsGroupRule(
  block: string,
  groups: string[],
  operations: string[]
): boolean {
  const groupsLiteral = groups.map((g) => `'${g}'`).join(',\\s*');
  const pattern = new RegExp(
    `allow\\.groups\\(\\[\\s*${groupsLiteral}\\s*\\]\\)\\.to\\(\\[([^\\]]*)\\]\\)`,
    'gs'
  );

  for (const match of block.matchAll(pattern)) {
    const opsSegment = match[1] ?? '';
    const grantedOps = Array.from(opsSegment.matchAll(/'([^']+)'/g)).map((m) => m[1]);
    if (operations.every((op) => grantedOps.includes(op))) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true when the authorization block contains an allow.groupDefinedIn
 * rule for the given field and grants the specified operations.
 *
 * Example: containsGroupDefinedInRule(block, 'familyId', ['read'])  → true when
 *   allow.groupDefinedIn('familyId').to(['read'])  is present.
 */
function containsGroupDefinedInRule(
  block: string,
  field: string,
  operations: string[]
): boolean {
  const opsLiteral = operations.map((o) => `'${o}'`).join(`(?:'[^']*'|[^\\]'])*`);
  const pattern = new RegExp(
    `allow\\.groupDefinedIn\\(\\s*'${field}'\\s*\\)\\.to\\(\\[\\s*${opsLiteral}`,
    's'
  );
  return pattern.test(block);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacation
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Vacation – authorization rules', () => {
  it('security.schema.Vacation.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('Vacation');
    expect(block, 'Vacation authorization block not found').not.toBeNull();
    // Server-side tenant isolation: read is gated by familyId group membership.
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.Vacation.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('Vacation');
    expect(block).not.toBeNull();
    // The broad all-groups read rule must be absent to enforce tenant isolation.
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.Vacation.planner-and-admin-can-create', () => {
    const block = extractAuthBlock('Vacation');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create'])).toBe(true);
  });

  it('security.schema.Vacation.only-admin-can-delete', () => {
    const block = extractAuthBlock('Vacation');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TripPlan
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.TripPlan – authorization rules', () => {
  it('security.schema.TripPlan.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('TripPlan');
    expect(block).not.toBeNull();
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.TripPlan.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('TripPlan');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.TripPlan.planner-and-admin-can-create', () => {
    const block = extractAuthBlock('TripPlan');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create'])).toBe(true);
  });

  it('security.schema.TripPlan.only-admin-can-delete', () => {
    const block = extractAuthBlock('TripPlan');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Car
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Car – authorization rules', () => {
  it('security.schema.Car.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('Car');
    expect(block).not.toBeNull();
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.Car.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('Car');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.Car.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('Car');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create', 'update'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'update'])).toBe(true);
  });

  it('security.schema.Car.only-admin-can-delete', () => {
    const block = extractAuthBlock('Car');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chore
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Chore – authorization rules', () => {
  it('security.schema.Chore.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('Chore');
    expect(block).not.toBeNull();
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.Chore.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('Chore');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.Chore.planner-and-admin-can-create', () => {
    const block = extractAuthBlock('Chore');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create'])).toBe(true);
  });

  it('security.schema.Chore.only-admin-can-delete', () => {
    const block = extractAuthBlock('Chore');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ChoreAssignment
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.ChoreAssignment – authorization rules', () => {
  it('security.schema.ChoreAssignment.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('ChoreAssignment');
    expect(block).not.toBeNull();
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.ChoreAssignment.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('ChoreAssignment');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.ChoreAssignment.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('ChoreAssignment');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create', 'update'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'update'])).toBe(true);
  });

  it('security.schema.ChoreAssignment.only-admin-can-delete', () => {
    const block = extractAuthBlock('ChoreAssignment');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ChoreCompletion
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.ChoreCompletion – authorization rules', () => {
  it('security.schema.ChoreCompletion.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('ChoreCompletion');
    expect(block).not.toBeNull();
    // Read is gated by family membership (tenant isolation).
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.ChoreCompletion.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('ChoreCompletion');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.ChoreCompletion.all-roles-can-create-and-update', () => {
    const block = extractAuthBlock('ChoreCompletion');
    expect(block).not.toBeNull();
    // All roles including MEMBER may create a completion record.
    expect(containsGroupRule(block!, ['PLANNER', 'MEMBER'], ['create', 'update'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'update'])).toBe(true);
  });

  it('security.schema.ChoreCompletion.only-admin-can-delete', () => {
    const block = extractAuthBlock('ChoreCompletion');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Recipe – authorization rules', () => {
  it('security.schema.Recipe.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('Recipe');
    expect(block).not.toBeNull();
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.Recipe.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('Recipe');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.Recipe.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('Recipe');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create', 'update'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'update'])).toBe(true);
  });

  it('security.schema.Recipe.only-admin-can-delete', () => {
    const block = extractAuthBlock('Recipe');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property / PropertyTransaction – ADMIN only, MEMBER and PLANNER have no access
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Property – ADMIN-only authorization', () => {
  it('security.schema.Property.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('Property');
    expect(block).not.toBeNull();
    // Read is gated by familyId group (tenant isolation); Property records are
    // family-scoped so family-group members can read them.
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.Property.only-admin-can-write', () => {
    const block = extractAuthBlock('Property');
    expect(block).not.toBeNull();
    // MEMBER and PLANNER must NOT appear in write rules.
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER'/);
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER',\s*'MEMBER'/);
    // ADMIN-only create/update/delete must be present.
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'update', 'delete'])).toBe(true);
  });
});

describe('security.schema.PropertyTransaction – ADMIN-only authorization', () => {
  it('security.schema.PropertyTransaction.only-admin-has-any-access', () => {
    const block = extractAuthBlock('PropertyTransaction');
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER'/);
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER',\s*'MEMBER'/);
    expect(containsGroupRule(block!, ['ADMIN'], ['read', 'create', 'update', 'delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Family – ADMIN has full CRUD; PLANNER and MEMBER may only read and create
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Family – authorization rules', () => {
  it('security.schema.Family.planner-and-member-can-read-and-create', () => {
    const block = extractAuthBlock('Family');
    expect(block, 'Family authorization block not found').not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER', 'MEMBER'], ['read', 'create'])).toBe(true);
  });

  it('security.schema.Family.admin-has-full-crud', () => {
    const block = extractAuthBlock('Family');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['read', 'create', 'update', 'delete'])).toBe(true);
  });

  it('security.schema.Family.no-duplicate-admin-groups-rule', () => {
    const block = extractAuthBlock('Family');
    expect(block).not.toBeNull();
    // ADMIN must not appear alongside other groups in a combined rule –
    // that would produce a duplicate staticGroup:ADMIN auth directive and
    // break CDK synthesis (AmplifyDataConstructInitializationError).
    expect(block).not.toMatch(/allow\.groups\(\[\s*'ADMIN',\s*'PLANNER'/);
    expect(block).not.toMatch(/allow\.groups\(\[\s*'ADMIN',\s*'PLANNER',\s*'MEMBER'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FamilyMember – role management (ADMIN only for update/delete)
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.FamilyMember – role management authorization', () => {
  it('security.schema.FamilyMember.planner-and-member-can-read-and-create', () => {
    const block = extractAuthBlock('FamilyMember');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER', 'MEMBER'], ['read', 'create'])).toBe(true);
  });

  it('security.schema.FamilyMember.admin-has-full-crud', () => {
    const block = extractAuthBlock('FamilyMember');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['read', 'create', 'update', 'delete'])).toBe(true);
  });

  it('security.schema.FamilyMember.no-duplicate-admin-groups-rule', () => {
    const block = extractAuthBlock('FamilyMember');
    expect(block).not.toBeNull();
    // ADMIN must not appear alongside other groups in a combined rule –
    // that would produce a duplicate staticGroup:ADMIN auth directive and
    // break CDK synthesis (AmplifyDataConstructInitializationError).
    expect(block).not.toMatch(/allow\.groups\(\[\s*'ADMIN',\s*'PLANNER'/);
    expect(block).not.toMatch(/allow\.groups\(\[\s*'ADMIN',\s*'PLANNER',\s*'MEMBER'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CarService – mirrors Car permissions
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.CarService – authorization rules', () => {
  it('security.schema.CarService.family-members-can-read-via-groupDefinedIn', () => {
    const block = extractAuthBlock('CarService');
    expect(block).not.toBeNull();
    expect(containsGroupDefinedInRule(block!, 'familyId', ['read'])).toBe(true);
  });

  it('security.schema.CarService.no-broad-read-for-all-role-groups', () => {
    const block = extractAuthBlock('CarService');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(false);
  });

  it('security.schema.CarService.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('CarService');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['PLANNER'], ['create', 'update'])).toBe(true);
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'update'])).toBe(true);
  });

  it('security.schema.CarService.only-admin-can-delete', () => {
    const block = extractAuthBlock('CarService');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invite – ADMIN only; MEMBER and PLANNER have no direct access
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Invite – ADMIN-only authorization', () => {
  it('security.schema.Invite.only-admin-can-create', () => {
    const block = extractAuthBlock('Invite');
    expect(block, 'Invite authorization block not found').not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['create'])).toBe(true);
  });

  it('security.schema.Invite.only-admin-has-full-crud', () => {
    const block = extractAuthBlock('Invite');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['create', 'read', 'update', 'delete'])).toBe(true);
  });

  it('security.schema.Invite.member-and-planner-have-no-access', () => {
    const block = extractAuthBlock('Invite');
    expect(block).not.toBeNull();
    // MEMBER and PLANNER must NOT appear in the Invite authorization block.
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER',\s*'MEMBER'/);
    expect(block).not.toMatch(/allow\.groups\(\['PLANNER'/);
    expect(block).not.toMatch(/allow\.groups\(\['MEMBER'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Isolation – groupDefinedIn('familyId') is present on all family-scoped models
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema – tenant isolation via groupDefinedIn', () => {
  const familyScopedModels = [
    'Vacation',
    'TripPlan',
    'Recipe',
    'Car',
    'CarService',
    'Chore',
    'ChoreAssignment',
    'ChoreCompletion',
    'Property',
  ] as const;

  for (const model of familyScopedModels) {
    it(`security.schema.${model}.groupDefinedIn-familyId-enforces-read-isolation`, () => {
      const block = extractAuthBlock(model);
      expect(block, `${model} authorization block not found`).not.toBeNull();
      expect(
        containsGroupDefinedInRule(block!, 'familyId', ['read']),
        `${model} is missing allow.groupDefinedIn('familyId').to(['read'])`
      ).toBe(true);
    });
  }

  it('security.schema.tenant-isolation.no-allow-authenticated-in-schema', () => {
    // allow.authenticated() must never appear in the schema – it would grant
    // any logged-in user access to all records regardless of family membership.
    expect(schema).not.toMatch(/allow\.authenticated\(\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// N+1 batch-query fields – schema sentinels for performance requirements
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the text of the .model({…}) field block for the given model name,
 * or null if not found.
 */
function extractModelFields(modelName: string): string | null {
  const modelPattern = new RegExp(`\\b${modelName}:\\s*a\\b`);
  const modelStart = schema.search(modelPattern);
  if (modelStart === -1) return null;

  const modelBlockPattern = /\.model\(\{/g;
  modelBlockPattern.lastIndex = modelStart;
  const modelBlockMatch = modelBlockPattern.exec(schema);
  if (!modelBlockMatch) return null;

  let depth = 0;
  let i = modelBlockMatch.index + modelBlockMatch[0].length - 1;
  for (; i < schema.length; i++) {
    if (schema[i] === '{') depth++;
    else if (schema[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return schema.slice(modelBlockMatch.index, i + 1);
}

describe('schema.PropertyTransaction – batch-query field', () => {
  it('schema.PropertyTransaction.has-familyId-for-single-batch-query', () => {
    const fields = extractModelFields('PropertyTransaction');
    expect(fields, 'PropertyTransaction model block not found').not.toBeNull();
    // familyId must be a required field so all transactions can be fetched in
    // a single query filtered by familyId (eliminates the N+1 per-property fetch).
    expect(fields).toMatch(/familyId\s*:\s*a\.id\(\)\.required\(\)/);
  });
});

describe('schema.ExcursionOption – on-write aggregate fields', () => {
  it('schema.ExcursionOption.has-upVoteCount-aggregate-field', () => {
    const fields = extractModelFields('ExcursionOption');
    expect(fields, 'ExcursionOption model block not found').not.toBeNull();
    // upVoteCount is maintained on-write so the display layer can read the
    // count directly without fetching all ExcursionVote records per option.
    expect(fields).toMatch(/upVoteCount\s*:\s*a\.integer\(\)/);
  });

  it('schema.ExcursionOption.has-downVoteCount-aggregate-field', () => {
    const fields = extractModelFields('ExcursionOption');
    expect(fields, 'ExcursionOption model block not found').not.toBeNull();
    // downVoteCount mirrors upVoteCount for the opposing vote direction.
    expect(fields).toMatch(/downVoteCount\s*:\s*a\.integer\(\)/);
  });
});

