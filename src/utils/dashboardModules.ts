export const DASHBOARD_MODULES = [
  'vacations',
  'planning',
  'property',
  'cars',
  'calendar',
  'cookbook',
  'chores',
] as const;

export type ActiveModule = (typeof DASHBOARD_MODULES)[number];
