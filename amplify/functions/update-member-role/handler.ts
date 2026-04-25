import type { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

// Injected by the Amplify backend at deploy time (see amplify/backend.ts).
const TABLE_NAME = process.env.FAMILY_MEMBER_TABLE_NAME!;

const VALID_ROLES = ['ADMIN', 'PLANNER', 'MEMBER'] as const;
type FamilyRole = (typeof VALID_ROLES)[number];

interface UpdateMemberRoleArgs {
  memberId: string;
  newRole: string;
}

interface MemberItem {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyRole;
  displayName?: string;
}

/**
 * AppSync Lambda resolver for the `updateMemberRole` custom mutation.
 *
 * Enforces:
 *   1. Valid role value check.
 *   2. Privilege-escalation protection – caller must be ADMIN.
 *   3. Cross-family protection – caller and target must share the same familyId.
 *   4. Last-admin guard – the final ADMIN in a family may not be demoted.
 */
export const handler: AppSyncResolverHandler<UpdateMemberRoleArgs, MemberItem> = async (
  event
) => {
  const { memberId, newRole } = event.arguments;

  // ── 1. Validate the requested role ────────────────────────────────────────
  if (!(VALID_ROLES as readonly string[]).includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  // ── 2. Resolve caller identity from AppSync context ───────────────────────
  // With Amplify Gen 2 email-based auth, event.identity.username equals the
  // Cognito username (email address), matching the userId stored in FamilyMember.
  const identity = event.identity as Record<string, any> | null;
  const callerUsername =
    identity?.username ?? identity?.claims?.email ?? null;
  if (!callerUsername) {
    throw new Error('Unauthorized: No identity found.');
  }

  // ── 3. Look up the target member by primary key ───────────────────────────
  const targetResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: memberId },
    })
  );
  const targetMember = targetResult.Item as MemberItem | undefined;
  if (!targetMember) {
    throw new Error('Member not found.');
  }

  // ── 4. Look up the caller's FamilyMember record ────────────────────────────
  const callerResult = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': callerUsername },
    })
  );
  const callerMember = callerResult.Items?.[0] as MemberItem | undefined;
  if (!callerMember) {
    throw new Error('Unauthorized: Caller has no family membership.');
  }

  // ── 5. Privilege-escalation protection ────────────────────────────────────
  if (callerMember.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only admins can update member roles.');
  }

  // ── 6. Cross-family protection ────────────────────────────────────────────
  if (targetMember.familyId !== callerMember.familyId) {
    throw new Error('Unauthorized: Cannot update members from a different family.');
  }

  // ── 7. Last-admin guard ───────────────────────────────────────────────────
  if (targetMember.role === 'ADMIN' && newRole !== 'ADMIN') {
    const adminCountResult = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'familyId = :familyId AND #role = :admin',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':familyId': callerMember.familyId,
          ':admin': 'ADMIN',
        },
      })
    );
    const adminCount =
      adminCountResult.Count ?? adminCountResult.Items?.length ?? 0;
    if (adminCount <= 1) {
      throw new Error('A family must have at least one administrator.');
    }
  }

  // ── 8. Apply the role update ───────────────────────────────────────────────
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: memberId },
      UpdateExpression: 'SET #role = :newRole',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':newRole': newRole },
    })
  );

  return {
    id: memberId,
    familyId: targetMember.familyId,
    userId: targetMember.userId,
    role: newRole as FamilyRole,
    displayName: targetMember.displayName ?? undefined,
  };
};
