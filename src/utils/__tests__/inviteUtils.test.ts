/**
 * Unit tests for invite input validation logic (src/utils/inviteUtils.ts).
 *
 * These tests mirror the server-side validation performed by the
 * createInvite Lambda resolver, ensuring consistent behaviour between the
 * client-side utility and the backend handler.
 */

import { describe, it, expect } from 'vitest';
import { validateInviteInput, isValidInviteRole } from '../inviteUtils';

// ─────────────────────────────────────────────────────────────────────────────
// validateInviteInput – happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('validateInviteInput – valid inputs', () => {
  it('returns null for a valid MEMBER invite', () => {
    expect(
      validateInviteInput({ familyId: 'fam-1', email: 'alice@example.com', role: 'MEMBER' })
    ).toBeNull();
  });

  it('returns null for a valid PLANNER invite', () => {
    expect(
      validateInviteInput({ familyId: 'fam-1', email: 'bob@example.com', role: 'PLANNER' })
    ).toBeNull();
  });

  it('accepts email addresses with different domains', () => {
    expect(
      validateInviteInput({ familyId: 'fam-1', email: 'user@sub.domain.org', role: 'MEMBER' })
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateInviteInput – invalid role
// ─────────────────────────────────────────────────────────────────────────────

describe('validateInviteInput – invalid role', () => {
  it('rejects ADMIN as an invite role', () => {
    const result = validateInviteInput({ familyId: 'fam-1', email: 'a@b.com', role: 'ADMIN' });
    expect(result).not.toBeNull();
    expect(result).toContain('ADMIN');
  });

  it('rejects an unknown role string', () => {
    const result = validateInviteInput({ familyId: 'fam-1', email: 'a@b.com', role: 'SUPERUSER' });
    expect(result).not.toBeNull();
    expect(result).toContain('SUPERUSER');
  });

  it('rejects an empty role string', () => {
    const result = validateInviteInput({ familyId: 'fam-1', email: 'a@b.com', role: '' });
    expect(result).not.toBeNull();
  });

  it('rejects a lowercase role string (roles are case-sensitive)', () => {
    const result = validateInviteInput({ familyId: 'fam-1', email: 'a@b.com', role: 'member' });
    expect(result).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateInviteInput – missing or blank familyId
// ─────────────────────────────────────────────────────────────────────────────

describe('validateInviteInput – invalid familyId', () => {
  it('rejects an empty familyId', () => {
    const result = validateInviteInput({ familyId: '', email: 'a@b.com', role: 'MEMBER' });
    expect(result).not.toBeNull();
    expect(result).toContain('familyId');
  });

  it('rejects a whitespace-only familyId', () => {
    const result = validateInviteInput({ familyId: '   ', email: 'a@b.com', role: 'MEMBER' });
    expect(result).not.toBeNull();
    expect(result).toContain('familyId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateInviteInput – missing or blank email
// ─────────────────────────────────────────────────────────────────────────────

describe('validateInviteInput – invalid email', () => {
  it('rejects an empty email', () => {
    const result = validateInviteInput({ familyId: 'fam-1', email: '', role: 'MEMBER' });
    expect(result).not.toBeNull();
    expect(result).toContain('email');
  });

  it('rejects a whitespace-only email', () => {
    const result = validateInviteInput({ familyId: 'fam-1', email: '   ', role: 'MEMBER' });
    expect(result).not.toBeNull();
    expect(result).toContain('email');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValidInviteRole
// ─────────────────────────────────────────────────────────────────────────────

describe('isValidInviteRole', () => {
  it('returns true for MEMBER', () => {
    expect(isValidInviteRole('MEMBER')).toBe(true);
  });

  it('returns true for PLANNER', () => {
    expect(isValidInviteRole('PLANNER')).toBe(true);
  });

  it('returns false for ADMIN', () => {
    expect(isValidInviteRole('ADMIN')).toBe(false);
  });

  it('returns false for an unknown string', () => {
    expect(isValidInviteRole('OWNER')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidInviteRole('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Security regression – ADMIN cannot be invited
// ─────────────────────────────────────────────────────────────────────────────

describe('security – ADMIN cannot be an invite role', () => {
  it('security.invite.admin-role-blocked', () => {
    expect(isValidInviteRole('ADMIN')).toBe(false);
  });

  it('security.invite.admin-invite-input-validation-fails', () => {
    const err = validateInviteInput({ familyId: 'fam-1', email: 'admin@example.com', role: 'ADMIN' });
    expect(err).not.toBeNull();
  });

  it('security.invite.only-member-and-planner-are-valid-invite-roles', () => {
    expect(isValidInviteRole('MEMBER')).toBe(true);
    expect(isValidInviteRole('PLANNER')).toBe(true);
    expect(isValidInviteRole('ADMIN')).toBe(false);
  });
});
