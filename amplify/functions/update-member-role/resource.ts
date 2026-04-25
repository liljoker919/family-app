import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda function that enforces server-side guardrails for member-role updates:
 *   - Caller must be an ADMIN in the same family as the target (cross-family protection).
 *   - The final ADMIN of a family may not be demoted (last-admin guard).
 */
export const updateMemberRoleFn = defineFunction({
  name: 'update-member-role',
  entry: './handler.ts',
});
