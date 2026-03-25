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
] as const;

export type ActiveModule = (typeof DASHBOARD_MODULES)[number];
