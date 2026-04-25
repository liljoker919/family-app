import type { FamilyRole } from './familyContext';

/**
 * Roles that may create, edit, and update content in modules where MEMBER
 * users have read-only access (e.g. TripPlan, Chore management).
 *
 * Role authority is managed through the FamilyMember model, not through
 * Cognito group membership.  Always use these constants instead of reading
 * Cognito group claims from the auth session.
 */
export const EDITOR_ROLES: readonly FamilyRole[] = ['ADMIN', 'PLANNER'];

/**
 * Roles that may permanently delete records.  Delete operations are
 * restricted to ADMIN at both the API and UI layers to prevent accidental
 * or malicious data loss by lower-privilege roles.
 */
export const ADMIN_ONLY_ROLES: readonly FamilyRole[] = ['ADMIN'];

/**
 * Returns true if the given FamilyMember role may create or update content.
 * MEMBER users are read-only in protected modules.
 */
export function canEditContent(role: FamilyRole): boolean {
  return EDITOR_ROLES.includes(role);
}

/**
 * Returns true if the given FamilyMember role may delete records.
 * Only ADMIN users are permitted to delete records; the same restriction
 * is enforced at the API level via the Amplify schema authorization rules.
 */
export function canDeleteContent(role: FamilyRole): boolean {
  return ADMIN_ONLY_ROLES.includes(role);
}
