import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildAuthResourceMap, getUserPoolId } from '../backend-auth-utils';

describe('backend auth utilities', () => {
  it('includes the auth resource only when requested', () => {
    const authResource = { name: 'auth-resource' };

    expect(buildAuthResourceMap(true, authResource)).toEqual({ auth: authResource });
    expect(buildAuthResourceMap(false, authResource)).toEqual({});
  });

  it('returns the user pool id when auth resources are available', () => {
    expect(
      getUserPoolId({
        auth: {
          resources: {
            userPool: {
              userPoolId: 'pool-id',
            },
          },
        },
      }),
    ).toBe('pool-id');
  });

  it('returns undefined when auth resources are detached', () => {
    expect(getUserPoolId({})).toBeUndefined();
  });
});
