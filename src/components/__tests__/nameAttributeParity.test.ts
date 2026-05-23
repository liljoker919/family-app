import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { amplifyConfig } from '../../amplifyconfiguration';
import { authPageFormFields } from '../AuthPage';
import { dashboardFormFields } from '../Dashboard';
import { buildInviteFormFields } from '../InvitePage';

const backendAuthSource = readFileSync(
  new URL('../../../amplify/auth/resource.ts', import.meta.url),
  'utf8'
);

describe('profile name attribute parity', () => {
  it('marks given and family name as required in frontend amplify config', () => {
    expect(amplifyConfig.Auth.Cognito.userAttributes.given_name.required).toBe(true);
    expect(amplifyConfig.Auth.Cognito.userAttributes.family_name.required).toBe(true);
  });

  it('marks given and family name as required in backend auth resource', () => {
    expect(backendAuthSource).toMatch(/givenName:\s*\{[^}]*required:\s*true/);
    expect(backendAuthSource).toMatch(/familyName:\s*\{[^}]*required:\s*true/);
  });

  it('enforces required first and last name in all signup form field definitions', () => {
    const inviteFormFields = buildInviteFormFields('person@example.com');

    expect(authPageFormFields.signUp.given_name.isRequired).toBe(true);
    expect(authPageFormFields.signUp.family_name.isRequired).toBe(true);

    expect(dashboardFormFields.signUp.given_name.isRequired).toBe(true);
    expect(dashboardFormFields.signUp.family_name.isRequired).toBe(true);

    expect(inviteFormFields.signUp.given_name.isRequired).toBe(true);
    expect(inviteFormFields.signUp.family_name.isRequired).toBe(true);
  });
});
