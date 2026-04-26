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
  // Each operation must appear inside the .to([...]) array, separated only by
  // commas and whitespace – using a narrow character class avoids false
  // positives from comments or adjacent string literals.
  const opsLiteral = operations.map((o) => `'${o}'`).join(`(?:'[^']*'|[^\\]'])*`);

  const pattern = new RegExp(
    `allow\\.groups\\(\\[\\s*${groupsLiteral}\\s*\\]\\)\\.to\\(\\[\\s*${opsLiteral}`,
    's'
  );
  return pattern.test(block);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vacation
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.Vacation – authorization rules', () => {
  it('security.schema.Vacation.all-groups-can-read-and-update', () => {
    const block = extractAuthBlock('Vacation');
    expect(block, 'Vacation authorization block not found').not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.Vacation.planner-and-admin-can-create', () => {
    const block = extractAuthBlock('Vacation');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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
  it('security.schema.TripPlan.all-groups-can-read-and-update', () => {
    const block = extractAuthBlock('TripPlan');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.TripPlan.planner-and-admin-can-create', () => {
    const block = extractAuthBlock('TripPlan');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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
  it('security.schema.Car.all-groups-can-read', () => {
    const block = extractAuthBlock('Car');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.Car.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('Car');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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
  it('security.schema.Chore.all-groups-can-read-and-update', () => {
    const block = extractAuthBlock('Chore');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.Chore.planner-and-admin-can-create', () => {
    const block = extractAuthBlock('Chore');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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
  it('security.schema.ChoreAssignment.all-groups-can-read', () => {
    const block = extractAuthBlock('ChoreAssignment');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.ChoreAssignment.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('ChoreAssignment');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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
  it('security.schema.ChoreCompletion.all-groups-can-read-create-and-update', () => {
    const block = extractAuthBlock('ChoreCompletion');
    expect(block).not.toBeNull();
    // All groups including MEMBER may create a completion record.
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read', 'create', 'update'])).toBe(true);
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
  it('security.schema.Recipe.all-groups-can-read', () => {
    const block = extractAuthBlock('Recipe');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.Recipe.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('Recipe');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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
  it('security.schema.Property.only-admin-has-any-access', () => {
    const block = extractAuthBlock('Property');
    expect(block).not.toBeNull();
    // MEMBER and PLANNER must NOT appear in the Property authorization block.
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER'/);
    expect(block).not.toMatch(/allow\.groups\(\['ADMIN',\s*'PLANNER',\s*'MEMBER'/);
    // ADMIN-only rule must be present.
    expect(containsGroupRule(block!, ['ADMIN'], ['read', 'create', 'update', 'delete'])).toBe(true);
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
// FamilyMember – role management (ADMIN only for update/delete)
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.FamilyMember – role management authorization', () => {
  it('security.schema.FamilyMember.all-groups-can-read-and-create', () => {
    const block = extractAuthBlock('FamilyMember');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read', 'create'])).toBe(true);
  });

  it('security.schema.FamilyMember.only-admin-can-update-and-delete', () => {
    const block = extractAuthBlock('FamilyMember');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN'], ['update', 'delete'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CarService – mirrors Car permissions
// ─────────────────────────────────────────────────────────────────────────────

describe('security.schema.CarService – authorization rules', () => {
  it('security.schema.CarService.all-groups-can-read', () => {
    const block = extractAuthBlock('CarService');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER', 'MEMBER'], ['read'])).toBe(true);
  });

  it('security.schema.CarService.planner-and-admin-can-create-and-update', () => {
    const block = extractAuthBlock('CarService');
    expect(block).not.toBeNull();
    expect(containsGroupRule(block!, ['ADMIN', 'PLANNER'], ['create'])).toBe(true);
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

