import { describe, it, expect } from 'vitest';
import { EDITOR_ROLES, canEditContent } from '../rolePermissions';
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

describe('canEditContent', () => {
  it('allows ADMIN to create/edit/delete content', () => {
    expect(canEditContent('ADMIN')).toBe(true);
  });

  it('allows PLANNER to create/edit/delete content', () => {
    expect(canEditContent('PLANNER')).toBe(true);
  });

  it('denies MEMBER from creating/editing/deleting content', () => {
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
