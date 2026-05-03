import { describe, it, expect } from 'vitest';
import { ADMIN_ONLY_ROLES, canEditContent, canDeleteContent } from '../rolePermissions';
import type { FamilyRole } from '../familyContext';

describe('ADMIN_ONLY_ROLES', () => {
  it('includes ADMIN', () => {
    expect(ADMIN_ONLY_ROLES).toContain('ADMIN');
  });

  it('does not include MEMBER', () => {
    expect(ADMIN_ONLY_ROLES).not.toContain('MEMBER');
  });
});

describe('canEditContent', () => {
  it('allows ADMIN to create/edit content', () => {
    expect(canEditContent({ role: 'ADMIN', canPlan: true })).toBe(true);
  });

  it('allows planning-enabled MEMBER to create/edit content', () => {
    expect(canEditContent({ role: 'MEMBER', canPlan: true })).toBe(true);
  });

  it('denies planning-disabled MEMBER from creating/editing content', () => {
    expect(canEditContent({ role: 'MEMBER', canPlan: false })).toBe(false);
  });
});

describe('canDeleteContent', () => {
  it('allows ADMIN to delete records', () => {
    expect(canDeleteContent({ role: 'ADMIN', canPlan: true })).toBe(true);
  });

  it('denies planning-enabled MEMBER from deleting records', () => {
    expect(canDeleteContent({ role: 'MEMBER', canPlan: true })).toBe(false);
  });

  it('denies MEMBER from deleting records', () => {
    expect(canDeleteContent({ role: 'MEMBER', canPlan: false })).toBe(false);
  });

  it('only ADMIN may delete – mirrors backend schema authorization', () => {
    const memberships: Array<{ role: FamilyRole; canPlan: boolean }> = [
      { role: 'ADMIN', canPlan: true },
      { role: 'MEMBER', canPlan: true },
      { role: 'MEMBER', canPlan: false },
    ];
    const deleteCount = memberships.filter(canDeleteContent).length;
    const noDeleteCount = memberships.filter((m) => !canDeleteContent(m)).length;
    expect(deleteCount).toBe(1);   // ADMIN only
    expect(noDeleteCount).toBe(2); // MEMBER (canPlan or not)
  });
});
