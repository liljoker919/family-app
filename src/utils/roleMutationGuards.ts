import type { FamilyRole } from './familyContext';

/**
 * Validates a role update request, enforcing:
 *   1. The new role must be a valid FamilyRole value.
 *   2. The caller must hold the ADMIN role (privilege-escalation protection).
 *   3. The target member must belong to the caller's family (cross-family protection).
 *   4. The final ADMIN in a family may not be demoted (last-admin guard).
 *
 * This function contains the same logic executed by the server-side Lambda
 * resolver so that it can also be unit-tested and used for fast client-side
 * feedback without duplicating business rules.
 *
 * @returns An error message string when the update must be blocked, or
 *          `null` when the update is permitted.
 */
export function validateRoleUpdate(params: {
  callerRole: FamilyRole;
  callerFamilyId: string;
  targetCurrentRole: FamilyRole;
  targetFamilyId: string;
  newRole: FamilyRole;
  adminCountInFamily: number;
}): string | null {
  const {
    callerRole,
    callerFamilyId,
    targetCurrentRole,
    targetFamilyId,
    newRole,
    adminCountInFamily,
  } = params;

  const VALID_ROLES: FamilyRole[] = ['ADMIN', 'PLANNER', 'MEMBER'];

  if (!VALID_ROLES.includes(newRole)) {
    return `Invalid role: ${newRole}`;
  }

  // Privilege-escalation protection: only ADMINs may change roles.
  if (callerRole !== 'ADMIN') {
    return 'Unauthorized: Only admins can update member roles.';
  }

  // Cross-family protection: an admin may only manage their own family.
  if (callerFamilyId !== targetFamilyId) {
    return 'Unauthorized: Cannot update members from a different family.';
  }

  // Last-admin guard: prevent the family from losing all administrators.
  if (targetCurrentRole === 'ADMIN' && newRole !== 'ADMIN' && adminCountInFamily <= 1) {
    return 'A family must have at least one administrator.';
  }

  return null;
}
