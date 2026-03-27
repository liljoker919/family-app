import type { FamilyRole } from './familyContext';

/**
 * Roles that may create, edit, and delete content in modules where MEMBER
 * users have read-only access (e.g. TripPlan, Chore management).
 *
 * Role authority is managed through the FamilyMember model, not through
 * Cognito group membership.  Always use these constants instead of reading
 * Cognito group claims from the auth session.
 */
export const EDITOR_ROLES: readonly FamilyRole[] = ['ADMIN', 'PLANNER'];

/**
 * Returns true if the given FamilyMember role may create, update, or delete
 * content.  MEMBER users are read-only in protected modules.
 */
export function canEditContent(role: FamilyRole): boolean {
  return EDITOR_ROLES.includes(role);
}
