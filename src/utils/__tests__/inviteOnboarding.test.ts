/**
 * Unit tests for the invite-onboarding utilities added to familyContext.ts:
 *   - parseInviteParams  (pure function, no mocks needed)
 *   - redeemInviteToken  (calls Amplify client – mocked)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// parseInviteParams – pure function tests
// ---------------------------------------------------------------------------

import { parseInviteParams } from '../familyContext';

describe('parseInviteParams – happy paths', () => {
  it('parses all four fields from a full invite URL query string', () => {
    const result = parseInviteParams(
      '?token=abc-123&email=alice%40example.com&role=MEMBER&family=The%20Smiths'
    );
    expect(result.token).toBe('abc-123');
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('MEMBER');
    expect(result.family).toBe('The Smiths');
  });

  it('returns null for fields that are absent', () => {
    const result = parseInviteParams('?token=xyz-789');
    expect(result.token).toBe('xyz-789');
    expect(result.email).toBeNull();
    expect(result.role).toBeNull();
    expect(result.family).toBeNull();
  });

  it('returns all nulls for an empty query string', () => {
    const result = parseInviteParams('');
    expect(result.token).toBeNull();
    expect(result.email).toBeNull();
    expect(result.role).toBeNull();
    expect(result.family).toBeNull();
  });

  it('treats empty-string values as null', () => {
    const result = parseInviteParams('?token=&email=&role=&family=');
    expect(result.token).toBeNull();
    expect(result.email).toBeNull();
    expect(result.role).toBeNull();
    expect(result.family).toBeNull();
  });

  it('decodes percent-encoded email addresses', () => {
    const result = parseInviteParams('?token=t&email=user%2Btest%40domain.org');
    expect(result.email).toBe('user+test@domain.org');
  });

  it('decodes percent-encoded family names with spaces', () => {
    const result = parseInviteParams('?token=t&family=My%20Big%20Family');
    expect(result.family).toBe('My Big Family');
  });

  it('parses PLANNER role correctly', () => {
    const result = parseInviteParams('?token=t&role=PLANNER');
    expect(result.role).toBe('PLANNER');
  });
});

// ---------------------------------------------------------------------------
// redeemInviteToken – mocked Amplify client tests
// ---------------------------------------------------------------------------

const { mockRedeemInvite } = vi.hoisted(() => ({
  mockRedeemInvite: vi.fn(),
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      FamilyMember: { list: vi.fn(), create: vi.fn() },
      Family: { get: vi.fn(), list: vi.fn(), create: vi.fn() },
    },
    mutations: {
      redeemInvite: mockRedeemInvite,
    },
  }),
}));

import { redeemInviteToken } from '../familyContext';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('redeemInviteToken – success cases', () => {
  it('returns a FamilyMembership when the mutation succeeds', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: { familyId: 'fam-1', familyName: 'The Smiths', role: 'MEMBER' },
      errors: null,
    });

    const membership = await redeemInviteToken('valid-token');

    expect(membership.familyId).toBe('fam-1');
    expect(membership.familyName).toBe('The Smiths');
    expect(membership.role).toBe('MEMBER');
    expect(membership.displayName).toBeNull();
    expect(mockRedeemInvite).toHaveBeenCalledWith({ token: 'valid-token' });
  });

  it('returns PLANNER role when the invite role is PLANNER', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: { familyId: 'fam-2', familyName: 'The Joneses', role: 'PLANNER' },
      errors: null,
    });

    const membership = await redeemInviteToken('planner-token');
    expect(membership.role).toBe('PLANNER');
    expect(membership.familyName).toBe('The Joneses');
  });
});

describe('redeemInviteToken – error cases', () => {
  it('throws when the mutation returns errors', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: null,
      errors: [{ message: 'Invalid invite token.' }],
    });

    await expect(redeemInviteToken('bad-token')).rejects.toThrow('Invalid invite token.');
  });

  it('throws when the mutation returns no data and no errors', async () => {
    mockRedeemInvite.mockResolvedValue({ data: null, errors: null });

    await expect(redeemInviteToken('empty-token')).rejects.toThrow('Failed to redeem invite');
  });

  it('throws with the joined error messages when multiple errors are returned', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: null,
      errors: [
        { message: 'This invite has expired.' },
        { message: 'Secondary error.' },
      ],
    });

    await expect(redeemInviteToken('expired-token')).rejects.toThrow(
      'This invite has expired., Secondary error.'
    );
  });

  it('propagates network errors thrown by the client', async () => {
    mockRedeemInvite.mockRejectedValue(new Error('Network failure'));

    await expect(redeemInviteToken('network-error-token')).rejects.toThrow('Network failure');
  });
});

// ---------------------------------------------------------------------------
// Security regression – invite redemption guards
// ---------------------------------------------------------------------------

describe('security – redeemInviteToken guards', () => {
  it('security.invite.expired-token-throws', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: null,
      errors: [{ message: 'This invite has expired.' }],
    });
    await expect(redeemInviteToken('expired')).rejects.toThrow('expired');
  });

  it('security.invite.already-used-token-throws', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: null,
      errors: [{ message: 'This invite has already been used or is no longer valid.' }],
    });
    await expect(redeemInviteToken('used-token')).rejects.toThrow('already been used');
  });

  it('security.invite.wrong-email-throws', async () => {
    mockRedeemInvite.mockResolvedValue({
      data: null,
      errors: [{ message: 'This invite was not issued to your email address.' }],
    });
    await expect(redeemInviteToken('wrong-email-token')).rejects.toThrow('not issued to your email');
  });
});
