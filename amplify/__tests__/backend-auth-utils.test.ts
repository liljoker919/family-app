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

describe('backend auth default wiring', () => {
  it('keeps auth detached in the checked-in backend definition', () => {
    const backendSource = readFileSync(
      new URL('../backend.ts', import.meta.url),
      'utf8',
    );

    expect(backendSource).toMatch(/const\s+includeAuth\s*=\s*false\s*;/);
    expect(backendSource).toMatch(/buildAuthResourceMap\(\s*includeAuth\s*,\s*auth\s*\)/);
    expect(backendSource).toMatch(
      /\.\.\.\(\s*includeAuth\s*\?\s*\{\s*postConfirmation\s*\}\s*:\s*\{\s*\}\s*\)/,
    );
    expect(backendSource).toMatch(
      /\.\.\.\(\s*includeAuth\s*\?\s*\{\s*preSignUp\s*\}\s*:\s*\{\s*\}\s*\)/,
    );
  });
});
