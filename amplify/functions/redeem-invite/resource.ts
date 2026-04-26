import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that validates a one-time invite token and provisions
 * the new user into the correct family.
 *
 * The handler:
 *   - Resolves the caller's identity from AppSync context.
 *   - Looks up the invite record by token.
 *   - Validates status (PENDING) and expiry.
 *   - Verifies the invite email matches the caller's email.
 *   - Creates a FamilyMember record with the role from the invite.
 *   - Marks the invite status as ACCEPTED.
 *   - Returns the familyId, familyName, and role so the UI can set membership.
 */
export const redeemInviteFn = defineFunction({
  name: 'redeem-invite',
  entry: './handler.ts',
});
