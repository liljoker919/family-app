/**
 * Invite utility – pure validation helpers for the invite system.
 *
 * These functions mirror the server-side validation performed by the
 * createInvite Lambda resolver and are used both in the handler and in
 * unit tests.
 */

export type InviteRole = 'MEMBER' | 'PLANNER';

const VALID_INVITE_ROLES: readonly InviteRole[] = ['MEMBER', 'PLANNER'];

/**
 * Returns null when the invite input is valid, or an error message string
 * when validation fails.
 *
 * Validates:
 *   1. role must be MEMBER or PLANNER (not ADMIN – admins must be promoted).
 *   2. familyId must be a non-empty string.
 *   3. email must be a non-empty string.
 */
export function validateInviteInput(input: {
  familyId: string;
  email: string;
  role: string;
}): string | null {
  if (!(VALID_INVITE_ROLES as readonly string[]).includes(input.role)) {
    return `Invalid role: ${input.role}. Must be MEMBER or PLANNER.`;
  }
  if (!input.familyId || !input.familyId.trim()) {
    return 'familyId is required.';
  }
  if (!input.email || !input.email.trim()) {
    return 'email is required.';
  }
  return null;
}

/**
 * Returns true when the given role is a valid invite role (MEMBER or PLANNER).
 * ADMIN cannot be invited; they must be promoted by an existing ADMIN.
 */
export function isValidInviteRole(role: string): role is InviteRole {
  return (VALID_INVITE_ROLES as readonly string[]).includes(role);
}
