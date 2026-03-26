import { describe, it, expect } from 'vitest';
import { DASHBOARD_MODULES, MODULE_ROLE_REQUIREMENTS, canAccessModule } from '../dashboardModules';

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

describe('MODULE_ROLE_REQUIREMENTS', () => {
  it('restricts admin module to ADMIN role only', () => {
    expect(MODULE_ROLE_REQUIREMENTS.admin).toEqual(['ADMIN']);
  });

  it('restricts reporting module to ADMIN and PLANNER roles', () => {
    expect(MODULE_ROLE_REQUIREMENTS.reporting).toEqual(['ADMIN', 'PLANNER']);
  });

  it('leaves general modules unrestricted (null)', () => {
    const openModules = ['vacations', 'planning', 'property', 'cars', 'calendar', 'cookbook', 'chores'] as const;
    for (const mod of openModules) {
      expect(MODULE_ROLE_REQUIREMENTS[mod]).toBeNull();
    }
  });
});

describe('canAccessModule', () => {
  it('allows ADMIN to access all modules', () => {
    for (const mod of DASHBOARD_MODULES) {
      expect(canAccessModule(mod, 'ADMIN')).toBe(true);
    }
  });

  it('allows PLANNER to access reporting', () => {
    expect(canAccessModule('reporting', 'PLANNER')).toBe(true);
  });

  it('denies PLANNER access to admin', () => {
    expect(canAccessModule('admin', 'PLANNER')).toBe(false);
  });

  it('denies MEMBER access to reporting', () => {
    expect(canAccessModule('reporting', 'MEMBER')).toBe(false);
  });

  it('denies MEMBER access to admin', () => {
    expect(canAccessModule('admin', 'MEMBER')).toBe(false);
  });

  it('allows MEMBER to access all open modules', () => {
    const openModules = ['vacations', 'planning', 'property', 'cars', 'calendar', 'cookbook', 'chores'] as const;
    for (const mod of openModules) {
      expect(canAccessModule(mod, 'MEMBER')).toBe(true);
    }
  });
});
