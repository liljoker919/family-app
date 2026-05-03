import type { FamilyMembership, FamilyRole } from './familyContext';

export const DASHBOARD_MODULES = [
  'vacations',
  'planning',
  'property',
  'cars',
  'calendar',
  'cookbook',
  'chores',
  'reporting',
  'admin',
  'profile',
] as const;

export type ActiveModule = (typeof DASHBOARD_MODULES)[number];

/**
 * Defines which roles may access each module.
 * `null` means the module is accessible by all authenticated family members.
 * `PLAN` means users with planning capability (or ADMIN) may access.
 */
export type ModuleAccessRequirement = FamilyRole[] | 'PLAN' | null;

export const MODULE_ROLE_REQUIREMENTS: Record<ActiveModule, ModuleAccessRequirement> = {
  vacations: null,
  planning: null,
  property: null,
  cars: null,
  calendar: null,
  cookbook: null,
  chores: null,
  reporting: 'PLAN',
  admin: ['ADMIN'],
  profile: null,
};

/**
 * Returns true if the given member permissions allow access to the module.
 */
export function canAccessModule(
  module: ActiveModule,
  membership: Pick<FamilyMembership, 'role' | 'canPlan'>
): boolean {
  const required = MODULE_ROLE_REQUIREMENTS[module];
  if (required === null) return true;
  if (required === 'PLAN') {
    return membership.role === 'ADMIN' || membership.canPlan;
  }
  return required.includes(membership.role);
}
