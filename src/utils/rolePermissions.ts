import type { FamilyRole } from './familyContext';

/**
 * Roles that may permanently delete records.  Delete operations are
 * restricted to ADMIN at both the API and UI layers to prevent accidental
 * or malicious data loss by lower-privilege roles.
 */
export const ADMIN_ONLY_ROLES: readonly FamilyRole[] = ['ADMIN'];

/**
 * Returns true if the given membership may create or update content.
 * A member may edit content if they are an ADMIN or have the canPlan flag set.
 */
export function canEditContent(membership: { role: FamilyRole; canPlan: boolean }): boolean {
  return membership.role === 'ADMIN' || membership.canPlan;
}

/**
 * Returns true if the given FamilyMember role may delete records.
 * Only ADMIN users are permitted to delete records; the same restriction
 * is enforced at the API level via the Amplify schema authorization rules.
 */
export function canDeleteContent(membership: { role: FamilyRole; canPlan: boolean }): boolean {
  return membership.role === 'ADMIN';
}
