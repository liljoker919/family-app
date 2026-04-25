import { describe, it, expect } from 'vitest';
import { validateRoleUpdate } from '../roleMutationGuards';

// ---------------------------------------------------------------------------
// Happy-path: valid role changes that should be permitted
// ---------------------------------------------------------------------------
describe('validateRoleUpdate – permitted changes', () => {
  it('allows an ADMIN to promote a MEMBER to ADMIN', () => {
    expect(
      validateRoleUpdate({
        callerRole: 'ADMIN',
        callerFamilyId: 'family-1',
        targetCurrentRole: 'MEMBER',
        targetFamilyId: 'family-1',
        newRole: 'ADMIN',
        adminCountInFamily: 1,
      })
    ).toBeNull();
  });

  it('allows an ADMIN to demote another ADMIN when there are multiple admins', () => {
    expect(
      validateRoleUpdate({
        callerRole: 'ADMIN',
        callerFamilyId: 'family-1',
        targetCurrentRole: 'ADMIN',
        targetFamilyId: 'family-1',
        newRole: 'MEMBER',
        adminCountInFamily: 2,
      })
    ).toBeNull();
  });

  it('allows an ADMIN to change a MEMBER to PLANNER', () => {
    expect(
      validateRoleUpdate({
        callerRole: 'ADMIN',
        callerFamilyId: 'family-1',
        targetCurrentRole: 'MEMBER',
        targetFamilyId: 'family-1',
        newRole: 'PLANNER',
        adminCountInFamily: 1,
      })
    ).toBeNull();
  });

  it('allows an ADMIN to demote a PLANNER to MEMBER', () => {
    expect(
      validateRoleUpdate({
        callerRole: 'ADMIN',
        callerFamilyId: 'family-1',
        targetCurrentRole: 'PLANNER',
        targetFamilyId: 'family-1',
        newRole: 'MEMBER',
        adminCountInFamily: 1,
      })
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Last-admin guard
// ---------------------------------------------------------------------------
describe('validateRoleUpdate – last-admin guard', () => {
  it('blocks self-demotion when the caller is the only ADMIN', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'ADMIN',
      targetFamilyId: 'family-1',
      newRole: 'MEMBER',
      adminCountInFamily: 1,
    });
    expect(result).toBe('A family must have at least one administrator.');
  });

  it('blocks demotion of the sole ADMIN to PLANNER', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'ADMIN',
      targetFamilyId: 'family-1',
      newRole: 'PLANNER',
      adminCountInFamily: 1,
    });
    expect(result).toBe('A family must have at least one administrator.');
  });

  it('allows demotion when there are 2 or more admins', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'ADMIN',
      targetFamilyId: 'family-1',
      newRole: 'MEMBER',
      adminCountInFamily: 2,
    });
    expect(result).toBeNull();
  });

  it('does not apply the guard when the target is not currently ADMIN', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'PLANNER',
      targetFamilyId: 'family-1',
      newRole: 'MEMBER',
      adminCountInFamily: 1,
    });
    expect(result).toBeNull();
  });

  it('does not apply the guard when the new role is still ADMIN', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'ADMIN',
      targetFamilyId: 'family-1',
      newRole: 'ADMIN',
      adminCountInFamily: 1,
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-family protection
// ---------------------------------------------------------------------------
describe('validateRoleUpdate – cross-family protection', () => {
  it('blocks an ADMIN from changing a role in a different family', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-a',
      targetCurrentRole: 'MEMBER',
      targetFamilyId: 'family-b',
      newRole: 'ADMIN',
      adminCountInFamily: 1,
    });
    expect(result).toBe('Unauthorized: Cannot update members from a different family.');
  });

  it('allows an ADMIN to change a role within the same family', () => {
    const result = validateRoleUpdate({
      callerRole: 'ADMIN',
      callerFamilyId: 'family-a',
      targetCurrentRole: 'MEMBER',
      targetFamilyId: 'family-a',
      newRole: 'PLANNER',
      adminCountInFamily: 1,
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Privilege-escalation protection
// ---------------------------------------------------------------------------
describe('validateRoleUpdate – privilege-escalation protection', () => {
  it('blocks a PLANNER from changing any role', () => {
    const result = validateRoleUpdate({
      callerRole: 'PLANNER',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'MEMBER',
      targetFamilyId: 'family-1',
      newRole: 'ADMIN',
      adminCountInFamily: 1,
    });
    expect(result).toBe('Unauthorized: Only admins can update member roles.');
  });

  it('blocks a MEMBER from changing any role', () => {
    const result = validateRoleUpdate({
      callerRole: 'MEMBER',
      callerFamilyId: 'family-1',
      targetCurrentRole: 'MEMBER',
      targetFamilyId: 'family-1',
      newRole: 'PLANNER',
      adminCountInFamily: 1,
    });
    expect(result).toBe('Unauthorized: Only admins can update member roles.');
  });
});
