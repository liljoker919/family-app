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
const { mockFamilyMember, mockFamily, mockProfile, mockCreateFamilyBootstrap, mockAddSelfToFamilyGroup } = vi.hoisted(() => ({
  mockFamilyMember: {
    list: vi.fn(),
    create: vi.fn(),
  },
  mockFamily: {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
  },
  mockProfile: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockCreateFamilyBootstrap: vi.fn(),
  mockAddSelfToFamilyGroup: vi.fn(),
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      FamilyMember: mockFamilyMember,
      Family: mockFamily,
      Profile: mockProfile,
    },
    mutations: {
      createFamilyBootstrap: mockCreateFamilyBootstrap,
      addSelfToFamilyGroup: mockAddSelfToFamilyGroup,
    },
  }),
}));

import {
  getFamilyMembership,
  createFamily,
  joinFamily,
  startSoloTrial,
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
    mockCreateFamilyBootstrap.mockResolvedValue({
      data: { familyId: 'new-family', familyName: 'The Joneses', joinCode: 'XYZ789', role: 'ADMIN' },
    });
    mockAddSelfToFamilyGroup.mockResolvedValue({ data: { success: true } });

    const membership = await createFamily('The Joneses', 'user-1', 'Mom');
    expect(membership.familyId).toBe('new-family');
    expect(membership.role).toBe('ADMIN');
    expect(membership.familyName).toBe('The Joneses');
    expect(mockCreateFamilyBootstrap).toHaveBeenCalledOnce();
    expect(mockAddSelfToFamilyGroup).toHaveBeenCalledWith({ familyId: 'new-family' });
  });

  it('throws when createFamilyBootstrap returns errors', async () => {
    mockCreateFamilyBootstrap.mockResolvedValue({
      data: null,
      errors: [{ message: 'Validation error' }],
    });

    await expect(createFamily('Bad Family', 'user-2')).rejects.toThrow('Validation error');
  });

  it('retries group assignment when addSelfToFamilyGroup temporarily fails', async () => {
    vi.useFakeTimers();

    try {
      mockCreateFamilyBootstrap.mockResolvedValue({
        data: { familyId: 'retry-family', familyName: 'Retry Family', joinCode: 'RTY123', role: 'ADMIN' },
      });
      mockAddSelfToFamilyGroup
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ data: { success: true } });

      const membershipPromise = createFamily('Retry Family', 'user-1');

      await vi.advanceTimersByTimeAsync(300);

      const membership = await membershipPromise;

      expect(membership.familyId).toBe('retry-family');
      expect(mockAddSelfToFamilyGroup).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
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
    // Stored PLANNER is normalized to MEMBER with canPlan: true
    expect(membership?.role).toBe('MEMBER');
    expect(membership?.canPlan).toBe(true);
    expect(mockFamilyMember.create).not.toHaveBeenCalled();
  });

  it('retries group assignment when addSelfToFamilyGroup temporarily fails', async () => {
    vi.useFakeTimers();

    try {
      mockFamily.list.mockResolvedValue({
        data: [{ id: 'family-b', name: 'Family B', joinCode: 'VALID1' }],
      });
      mockFamilyMember.list.mockResolvedValue({ data: [] });
      mockFamilyMember.create.mockResolvedValue({
        data: { familyId: 'family-b', userId: 'user-3', role: 'MEMBER', displayName: null },
      });
      mockAddSelfToFamilyGroup
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ data: { success: true } });

      const membershipPromise = joinFamily('VALID1', 'user-3');
      await vi.advanceTimersByTimeAsync(300);
      const membership = await membershipPromise;

      expect(membership?.familyId).toBe('family-b');
      expect(mockAddSelfToFamilyGroup).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// startSoloTrial
// ---------------------------------------------------------------------------
describe('startSoloTrial', () => {
  /** Shared helper: set up bootstrap mutation mocks for createFamily */
  function setupCreateFamily() {
    mockCreateFamilyBootstrap.mockResolvedValue({
      data: { familyId: 'solo-family', familyName: 'My Family', joinCode: 'SOLO01', role: 'ADMIN' },
    });
    mockAddSelfToFamilyGroup.mockResolvedValue({ data: { success: true } });
  }

  it('updates an existing Profile with trial fields when one already exists', async () => {
    setupCreateFamily();
    mockProfile.list.mockResolvedValue({
      data: [{ id: 'profile-1', userId: 'user-solo', email: 'alice@example.com' }],
    });
    mockProfile.update.mockResolvedValue({ data: {} });

    const membership = await startSoloTrial('user-solo', 'alice@example.com', 'Alice');

    expect(membership.familyId).toBe('solo-family');
    expect(membership.role).toBe('ADMIN');
    expect(mockProfile.list).toHaveBeenCalledOnce();
    expect(mockProfile.update).toHaveBeenCalledOnce();
    expect(mockProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile-1', trialStatus: 'TRIAL' })
    );
    expect(mockProfile.create).not.toHaveBeenCalled();
  });

  it('creates a new Profile with trial fields when none exists', async () => {
    setupCreateFamily();
    mockProfile.list.mockResolvedValue({ data: [] });
    mockProfile.create.mockResolvedValue({ data: { id: 'profile-new' } });

    const membership = await startSoloTrial('user-solo', 'alice@example.com');

    expect(membership.familyId).toBe('solo-family');
    expect(mockProfile.create).toHaveBeenCalledOnce();
    expect(mockProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-solo',
        email: 'alice@example.com',
        trialStatus: 'TRIAL',
      })
    );
    expect(mockProfile.update).not.toHaveBeenCalled();
  });

  it('creates a new Profile when Profile.list returns null data', async () => {
    setupCreateFamily();
    mockProfile.list.mockResolvedValue({ data: null });
    mockProfile.create.mockResolvedValue({ data: { id: 'profile-new' } });

    const membership = await startSoloTrial('user-solo', 'alice@example.com');

    expect(membership.familyId).toBe('solo-family');
    expect(mockProfile.create).toHaveBeenCalledOnce();
    expect(mockProfile.update).not.toHaveBeenCalled();
  });

  it('still returns membership when Profile write throws (non-fatal)', async () => {
    setupCreateFamily();
    mockProfile.list.mockRejectedValue(new Error('network error'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const membership = await startSoloTrial('user-solo', 'alice@example.com');

    // Family creation succeeded — membership is returned despite profile error
    expect(membership.familyId).toBe('solo-family');
    expect(membership.role).toBe('ADMIN');
    // The non-fatal error path should log a warning
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws when family creation fails before profile setup', async () => {
    mockCreateFamilyBootstrap.mockResolvedValue({
      data: null,
      errors: [{ message: 'family create failed' }],
    });

    await expect(startSoloTrial('user-solo', 'alice@example.com')).rejects.toThrow(
      'family create failed'
    );
    expect(mockProfile.list).not.toHaveBeenCalled();
    expect(mockProfile.update).not.toHaveBeenCalled();
    expect(mockProfile.create).not.toHaveBeenCalled();
  });
});
