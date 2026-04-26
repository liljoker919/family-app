import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that creates a tokenized invite record in DynamoDB.
 * Only ADMIN users may call this mutation (enforced at the API layer).
 *
 * The handler:
 *   - Validates the requested role is MEMBER or PLANNER.
 *   - Generates a cryptographically random UUID token.
 *   - Persists an Invite record with status PENDING and a 7-day expiry.
 *   - Returns the invite URL that can be shared with the invitee.
 */
export const createInviteFn = defineFunction({
  name: 'create-invite',
  entry: './handler.ts',
});
