import type { FamilyRole } from './familyContext';

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
 */
export const MODULE_ROLE_REQUIREMENTS: Record<ActiveModule, FamilyRole[] | null> = {
  vacations: null,
  planning: null,
  property: null,
  cars: null,
  calendar: null,
  cookbook: null,
  chores: null,
  reporting: ['ADMIN', 'PLANNER'],
  admin: ['ADMIN'],
  profile: null,
};

/**
 * Returns true if the given role is permitted to access the given module.
 */
export function canAccessModule(module: ActiveModule, role: FamilyRole): boolean {
  const required = MODULE_ROLE_REQUIREMENTS[module];
  if (required === null) return true;
  return required.includes(role);
}
