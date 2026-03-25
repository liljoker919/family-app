import { describe, it, expect } from 'vitest';
import { DASHBOARD_MODULES } from '../dashboardModules';

describe('dashboard navigation modules', () => {
  it('includes the chores module', () => {
    expect(DASHBOARD_MODULES).toContain('chores');
  });

  it('includes the reporting module', () => {
    expect(DASHBOARD_MODULES).toContain('reporting');
  });

  it('includes the admin module', () => {
    expect(DASHBOARD_MODULES).toContain('admin');
  });

  it('includes all required navigation modules', () => {
    const required = ['vacations', 'planning', 'property', 'cars', 'calendar', 'cookbook', 'chores', 'reporting', 'admin'] as const;
    for (const mod of required) {
      expect(DASHBOARD_MODULES).toContain(mod);
    }
  });

  it('lists admin as the last navigation item', () => {
    expect(DASHBOARD_MODULES[DASHBOARD_MODULES.length - 1]).toBe('admin');
  });
});
