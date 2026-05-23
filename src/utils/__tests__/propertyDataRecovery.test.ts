import { beforeEach, describe, it, expect, vi } from 'vitest';

const { mockFetchAuthSession } = vi.hoisted(() => ({
  mockFetchAuthSession: vi.fn(),
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: mockFetchAuthSession,
}));

import {
  PropertyDataRecoverableError,
  getPropertyReadErrorMessage,
  isLikelyFamilyClaimPropagationDelay,
  mutatePropertyDataWithRetry,
  readPropertyDataWithRetry,
} from '../propertyDataRecovery';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isLikelyFamilyClaimPropagationDelay', () => {
  it('returns true for authorization-like errors', () => {
    expect(isLikelyFamilyClaimPropagationDelay(new Error('Not Authorized to access Property'))).toBe(true);
  });

  it('returns false for generic failures', () => {
    expect(isLikelyFamilyClaimPropagationDelay(new Error('Network timeout'))).toBe(false);
  });
});

describe('readPropertyDataWithRetry', () => {
  it('retries auth propagation failures and eventually succeeds', async () => {
    const fetchData = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValueOnce({
        properties: [{ id: 'property-1', name: 'Beach House' }],
        transactions: [],
      });

    const result = await readPropertyDataWithRetry(fetchData, {
      verifyPropertyId: 'property-1',
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(result.properties).toHaveLength(1);
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('retries until newly created property becomes visible', async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValueOnce({ properties: [], transactions: [] })
      .mockResolvedValueOnce({
        properties: [{ id: 'property-2', name: 'Lake Cabin' }],
        transactions: [],
      });

    const result = await readPropertyDataWithRetry(fetchData, {
      verifyPropertyId: 'property-2',
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(result.properties[0].id).toBe('property-2');
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('throws a recoverable visibility error when property never appears', async () => {
    const fetchData = vi.fn().mockResolvedValue({ properties: [], transactions: [] });

    await expect(
      readPropertyDataWithRetry(fetchData, {
        verifyPropertyId: 'missing-property',
        maxAttempts: 2,
        baseDelayMs: 0,
      })
    ).rejects.toMatchObject({
      name: 'PropertyDataRecoverableError',
      kind: 'VISIBILITY_SYNC',
    });
  });

  it('throws a recoverable auth error when authorization does not recover', async () => {
    const fetchData = vi.fn().mockRejectedValue(new Error('Not authorized to access this resource'));

    await expect(
      readPropertyDataWithRetry(fetchData, {
        maxAttempts: 2,
        baseDelayMs: 0,
      })
    ).rejects.toMatchObject({
      name: 'PropertyDataRecoverableError',
      kind: 'AUTH_SYNC',
    });
  });
});

describe('getPropertyReadErrorMessage', () => {
  it('returns recoverable message from typed recovery errors', () => {
    const message = getPropertyReadErrorMessage(
      new PropertyDataRecoverableError('AUTH_SYNC', 'Still syncing access.')
    );
    expect(message).toBe('Still syncing access.');
  });

  it('returns a generic message for unknown errors', () => {
    expect(getPropertyReadErrorMessage(new Error('boom'))).toBe(
      'Unable to load property data right now. Please try again.'
    );
  });
});

describe('mutatePropertyDataWithRetry', () => {
  it('retries authorization failures after syncing family access and refreshing the session', async () => {
    const mutateData = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        errors: [{ message: 'Unauthorized to access PropertyTransaction' }],
      })
      .mockResolvedValueOnce({
        data: { id: 'txn-1' },
        errors: null,
      });
    const syncFamilyAccess = vi.fn().mockResolvedValue(undefined);
    mockFetchAuthSession.mockResolvedValue({});

    const result = await mutatePropertyDataWithRetry(mutateData, {
      failureMessage: 'Failed to save transaction.',
      syncFamilyAccess,
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(result).toEqual({ id: 'txn-1' });
    expect(mutateData).toHaveBeenCalledTimes(2);
    expect(syncFamilyAccess).toHaveBeenCalledTimes(1);
    expect(mockFetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('throws a recoverable auth error when mutation authorization never recovers', async () => {
    const mutateData = vi.fn().mockResolvedValue({
      data: null,
      errors: [{ message: 'Not authorized to access this resource' }],
    });
    const syncFamilyAccess = vi.fn().mockResolvedValue(undefined);
    mockFetchAuthSession.mockResolvedValue({});

    await expect(
      mutatePropertyDataWithRetry(mutateData, {
        failureMessage: 'Failed to create property.',
        syncFamilyAccess,
        maxAttempts: 2,
        baseDelayMs: 0,
      })
    ).rejects.toMatchObject({
      name: 'PropertyDataRecoverableError',
      kind: 'AUTH_SYNC',
    });

    expect(syncFamilyAccess).toHaveBeenCalledTimes(1);
    expect(mockFetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('continues the retry loop when syncFamilyAccess rejects', async () => {
    const mutateData = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        errors: [{ message: 'Unauthorized to access PropertyTransaction' }],
      })
      .mockResolvedValueOnce({
        data: { id: 'txn-2' },
        errors: null,
      });
    const syncFamilyAccess = vi.fn().mockRejectedValue(new Error('addSelfToFamilyGroup transient failure'));
    mockFetchAuthSession.mockResolvedValue({});

    const result = await mutatePropertyDataWithRetry(mutateData, {
      failureMessage: 'Failed to save transaction.',
      syncFamilyAccess,
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(result).toEqual({ id: 'txn-2' });
    expect(mutateData).toHaveBeenCalledTimes(2);
    expect(syncFamilyAccess).toHaveBeenCalledTimes(1);
    expect(mockFetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('throws a recoverable auth error when syncFamilyAccess always rejects and mutation never recovers', async () => {
    const mutateData = vi.fn().mockResolvedValue({
      data: null,
      errors: [{ message: 'Not authorized to access this resource' }],
    });
    const syncFamilyAccess = vi.fn().mockRejectedValue(new Error('addSelfToFamilyGroup transient failure'));
    mockFetchAuthSession.mockResolvedValue({});

    await expect(
      mutatePropertyDataWithRetry(mutateData, {
        failureMessage: 'Failed to create property.',
        syncFamilyAccess,
        maxAttempts: 3,
        baseDelayMs: 0,
      })
    ).rejects.toMatchObject({
      name: 'PropertyDataRecoverableError',
      kind: 'AUTH_SYNC',
    });

    expect(mutateData).toHaveBeenCalledTimes(3);
    expect(syncFamilyAccess).toHaveBeenCalledTimes(2);
    expect(mockFetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
  });
});
