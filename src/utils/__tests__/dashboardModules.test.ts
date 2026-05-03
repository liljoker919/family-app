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
    const required = ['vacations', 'property', 'cars', 'calendar', 'cookbook', 'chores', 'reporting', 'admin', 'profile'] as const;
    for (const mod of required) {
      expect(DASHBOARD_MODULES).toContain(mod);
    }
  });

  it('lists profile as the last navigation item', () => {
    expect(DASHBOARD_MODULES[DASHBOARD_MODULES.length - 1]).toBe('profile');
  });
});

describe('MODULE_ROLE_REQUIREMENTS', () => {
  it('restricts admin module to ADMIN role only', () => {
    expect(MODULE_ROLE_REQUIREMENTS.admin).toEqual(['ADMIN']);
  });

  it('restricts reporting module to planning-enabled members and admins', () => {
    expect(MODULE_ROLE_REQUIREMENTS.reporting).toBe('PLAN');
  });

  it('leaves general modules unrestricted (null)', () => {
    const openModules = ['vacations', 'property', 'cars', 'calendar', 'cookbook', 'chores'] as const;
    for (const mod of openModules) {
      expect(MODULE_ROLE_REQUIREMENTS[mod]).toBeNull();
    }
  });

  it('leaves the profile module unrestricted (null)', () => {
    expect(MODULE_ROLE_REQUIREMENTS.profile).toBeNull();
  });
});

describe('canAccessModule', () => {
  it('allows ADMIN to access all modules', () => {
    const adminMembership = { role: 'ADMIN' as const, canPlan: true };
    for (const mod of DASHBOARD_MODULES) {
      expect(canAccessModule(mod, adminMembership)).toBe(true);
    }
  });

  it('allows planning-enabled MEMBER to access reporting', () => {
    expect(canAccessModule('reporting', { role: 'MEMBER', canPlan: true })).toBe(true);
  });

  it('denies planning-disabled MEMBER access to reporting', () => {
    expect(canAccessModule('reporting', { role: 'MEMBER', canPlan: false })).toBe(false);
  });

  it('denies MEMBER access to admin', () => {
    expect(canAccessModule('admin', { role: 'MEMBER', canPlan: true })).toBe(false);
    expect(canAccessModule('admin', { role: 'MEMBER', canPlan: false })).toBe(false);
  });

  it('allows MEMBER to access all open modules regardless of canPlan', () => {
    const openModules = ['vacations', 'property', 'cars', 'calendar', 'cookbook', 'chores'] as const;
    for (const mod of openModules) {
      expect(canAccessModule(mod, { role: 'MEMBER', canPlan: false })).toBe(true);
      expect(canAccessModule(mod, { role: 'MEMBER', canPlan: true })).toBe(true);
    }
  });

  it('allows all memberships to access the profile module', () => {
    const memberships = [
      { role: 'ADMIN' as const, canPlan: true },
      { role: 'MEMBER' as const, canPlan: false },
      { role: 'MEMBER' as const, canPlan: true },
    ];

    for (const membership of memberships) {
      expect(canAccessModule('profile', membership)).toBe(true);
    }
  });
});
