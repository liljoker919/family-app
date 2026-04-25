import { describe, it, expect } from 'vitest';
import { EDITOR_ROLES, ADMIN_ONLY_ROLES, canEditContent, canDeleteContent } from '../rolePermissions';
import type { FamilyRole } from '../familyContext';

describe('EDITOR_ROLES', () => {
  it('includes ADMIN', () => {
    expect(EDITOR_ROLES).toContain('ADMIN');
  });

  it('includes PLANNER', () => {
    expect(EDITOR_ROLES).toContain('PLANNER');
  });

  it('does not include MEMBER', () => {
    expect(EDITOR_ROLES).not.toContain('MEMBER');
  });
});

describe('ADMIN_ONLY_ROLES', () => {
  it('includes ADMIN', () => {
    expect(ADMIN_ONLY_ROLES).toContain('ADMIN');
  });

  it('does not include PLANNER', () => {
    expect(ADMIN_ONLY_ROLES).not.toContain('PLANNER');
  });

  it('does not include MEMBER', () => {
    expect(ADMIN_ONLY_ROLES).not.toContain('MEMBER');
  });
});

describe('canEditContent', () => {
  it('allows ADMIN to create/edit content', () => {
    expect(canEditContent('ADMIN')).toBe(true);
  });

  it('allows PLANNER to create/edit content', () => {
    expect(canEditContent('PLANNER')).toBe(true);
  });

  it('denies MEMBER from creating/editing content', () => {
    expect(canEditContent('MEMBER')).toBe(false);
  });

  it('covers all FamilyRole values without ambiguity', () => {
    const allRoles: FamilyRole[] = ['ADMIN', 'PLANNER', 'MEMBER'];
    const editorCount = allRoles.filter(canEditContent).length;
    const readOnlyCount = allRoles.filter((r) => !canEditContent(r)).length;
    expect(editorCount).toBe(2);   // ADMIN + PLANNER
    expect(readOnlyCount).toBe(1); // MEMBER
  });
});

describe('canDeleteContent', () => {
  it('allows ADMIN to delete records', () => {
    expect(canDeleteContent('ADMIN')).toBe(true);
  });

  it('denies PLANNER from deleting records', () => {
    expect(canDeleteContent('PLANNER')).toBe(false);
  });

  it('denies MEMBER from deleting records', () => {
    expect(canDeleteContent('MEMBER')).toBe(false);
  });

  it('only ADMIN may delete – mirrors backend schema authorization', () => {
    const allRoles: FamilyRole[] = ['ADMIN', 'PLANNER', 'MEMBER'];
    const deleteCount = allRoles.filter(canDeleteContent).length;
    const noDeleteCount = allRoles.filter((r) => !canDeleteContent(r)).length;
    expect(deleteCount).toBe(1);   // ADMIN only
    expect(noDeleteCount).toBe(2); // PLANNER + MEMBER
  });
});
