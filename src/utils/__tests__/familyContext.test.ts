import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateJoinCode } from '../familyContext';

// ---------------------------------------------------------------------------
// generateJoinCode – pure function, testable without a backend
// ---------------------------------------------------------------------------
describe('generateJoinCode', () => {
  it('returns a 6-character string', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it('only contains uppercase alphanumeric characters (no ambiguous chars)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('generates unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    // With a 6-char code from 32 chars, collisions in 20 draws are astronomically rare
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// getFamilyMembership / createFamily / joinFamily
// These functions call the Amplify client, so we mock it.
// vi.hoisted ensures the mock variables are defined before the module factory runs.
// ---------------------------------------------------------------------------
const { mockFamilyMember, mockFamily } = vi.hoisted(() => ({
  mockFamilyMember: {
    list: vi.fn(),
    create: vi.fn(),
  },
  mockFamily: {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      FamilyMember: mockFamilyMember,
      Family: mockFamily,
    },
  }),
}));

import {
  getFamilyMembership,
  createFamily,
  joinFamily,
} from '../familyContext';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getFamilyMembership', () => {
  it('returns null when no FamilyMember record exists for the user', async () => {
    mockFamilyMember.list.mockResolvedValue({ data: [] });
    const result = await getFamilyMembership('user-abc');
    expect(result).toBeNull();
  });

  it('returns the membership when a FamilyMember record exists', async () => {
    mockFamilyMember.list.mockResolvedValue({
      data: [{ familyId: 'family-1', userId: 'user-abc', role: 'ADMIN', displayName: 'Dad' }],
    });
    mockFamily.get.mockResolvedValue({
      data: { id: 'family-1', name: 'The Smiths' },
    });

    const result = await getFamilyMembership('user-abc');
    expect(result).not.toBeNull();
    expect(result?.familyId).toBe('family-1');
    expect(result?.role).toBe('ADMIN');
    expect(result?.familyName).toBe('The Smiths');
  });

  it('returns null when an error is thrown', async () => {
    mockFamilyMember.list.mockRejectedValue(new Error('network error'));
    const result = await getFamilyMembership('user-xyz');
    expect(result).toBeNull();
  });
});

describe('tenant isolation boundary - getFamilyMembership', () => {
  it('user from Family A gets familyId A, not Family B', async () => {
    mockFamilyMember.list.mockImplementation(({ filter }: any) => {
      if (filter.userId.eq === 'user-a') {
        return Promise.resolve({
          data: [{ familyId: 'family-a', userId: 'user-a', role: 'MEMBER', displayName: null }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    mockFamily.get.mockResolvedValue({ data: { id: 'family-a', name: 'Family A' } });

    const membershipA = await getFamilyMembership('user-a');
    const membershipB = await getFamilyMembership('user-b');

    expect(membershipA?.familyId).toBe('family-a');
    expect(membershipB).toBeNull();
  });
});

describe('createFamily', () => {
  it('creates a Family and FamilyMember with ADMIN role', async () => {
    mockFamily.create.mockResolvedValue({
      data: { id: 'new-family', name: 'The Joneses', joinCode: 'XYZ789' },
    });
    mockFamilyMember.create.mockResolvedValue({
      data: { familyId: 'new-family', userId: 'user-1', role: 'ADMIN', displayName: 'Mom' },
    });

    const membership = await createFamily('The Joneses', 'user-1', 'Mom');
    expect(membership.familyId).toBe('new-family');
    expect(membership.role).toBe('ADMIN');
    expect(membership.familyName).toBe('The Joneses');
    expect(mockFamily.create).toHaveBeenCalledOnce();
    expect(mockFamilyMember.create).toHaveBeenCalledOnce();
  });

  it('throws when Family.create returns errors', async () => {
    mockFamily.create.mockResolvedValue({
      data: null,
      errors: [{ message: 'Validation error' }],
    });

    await expect(createFamily('Bad Family', 'user-2')).rejects.toThrow('Validation error');
  });
});

describe('joinFamily', () => {
  it('returns null when the join code is not found', async () => {
    mockFamily.list.mockResolvedValue({ data: [] });
    const result = await joinFamily('BADCOD', 'user-3');
    expect(result).toBeNull();
  });

  it('creates a MEMBER record when the join code is valid', async () => {
    mockFamily.list.mockResolvedValue({
      data: [{ id: 'family-b', name: 'Family B', joinCode: 'VALID1' }],
    });
    mockFamilyMember.list.mockResolvedValue({ data: [] });
    mockFamilyMember.create.mockResolvedValue({
      data: { familyId: 'family-b', userId: 'user-3', role: 'MEMBER', displayName: null },
    });

    const membership = await joinFamily('VALID1', 'user-3');
    expect(membership).not.toBeNull();
    expect(membership?.familyId).toBe('family-b');
    expect(membership?.role).toBe('MEMBER');
  });

  it('returns existing membership without creating a duplicate', async () => {
    mockFamily.list.mockResolvedValue({
      data: [{ id: 'family-b', name: 'Family B', joinCode: 'VALID1' }],
    });
    mockFamilyMember.list.mockResolvedValue({
      data: [{ familyId: 'family-b', userId: 'user-3', role: 'PLANNER', displayName: 'Grandma' }],
    });

    const membership = await joinFamily('VALID1', 'user-3');
    expect(membership?.role).toBe('PLANNER');
    expect(mockFamilyMember.create).not.toHaveBeenCalled();
  });
});
