import type { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  GetGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const cognitoClient = new CognitoIdentityProviderClient();

// Injected by the Amplify backend at deploy time (see amplify/backend.ts).
const FAMILY_MEMBER_TABLE_NAME = process.env.FAMILY_MEMBER_TABLE_NAME!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

interface AddToFamilyGroupArgs {
  familyId: string;
}

interface AddToFamilyGroupResult {
  success: boolean;
  familyId: string;
}

/**
 * AppSync Lambda resolver for the `addSelfToFamilyGroup` mutation.
 *
 * Enforces server-side tenant isolation by managing Cognito group membership:
 *   1. Verifies the caller is a member of the specified family (DynamoDB lookup).
 *   2. Creates a Cognito group named after the familyId if it does not exist.
 *   3. Adds the caller to that Cognito group.
 *
 * After this mutation completes, the caller's JWT will include the familyId
 * as a Cognito group, which satisfies the `allow.groupDefinedIn('familyId')`
 * authorization rule on all family-scoped models.
 *
 * This mutation must be called after:
 *   - Creating a new family (createFamily client flow)
 *   - Joining a family via join code (joinFamily client flow)
 * For invite-based joins, the redeemInvite Lambda calls this logic directly.
 */
export const handler: AppSyncResolverHandler<
  AddToFamilyGroupArgs,
  AddToFamilyGroupResult
> = async (event) => {
  const { familyId } = event.arguments;

  if (!familyId || !familyId.trim()) {
    throw new Error('familyId is required.');
  }

  // ── 1. Resolve caller identity from AppSync context ───────────────────────
  const identity = event.identity as Record<string, any> | null;
  const callerUsername =
    identity?.username ?? identity?.claims?.email ?? null;
  if (!callerUsername) {
    throw new Error('Unauthorized: No identity found.');
  }

  // ── 2. Verify the caller is a member of the specified family ──────────────
  const memberResult = await ddb.send(
    new ScanCommand({
      TableName: FAMILY_MEMBER_TABLE_NAME,
      FilterExpression: 'userId = :userId AND familyId = :familyId',
      ExpressionAttributeValues: {
        ':userId': callerUsername,
        ':familyId': familyId.trim(),
      },
    })
  );

  if (!memberResult.Items || memberResult.Items.length === 0) {
    throw new Error(
      'Unauthorized: You are not a member of the specified family.'
    );
  }

  // ── 3. Ensure the Cognito group for this family exists ─────────────────────
  // Cognito group name equals the familyId (a UUID), which is a valid group name.
  // Groups are lazily created on first join so no migration is needed.
  try {
    await cognitoClient.send(
      new GetGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: familyId.trim(),
      })
    );
  } catch (err: any) {
    if (err?.name === 'ResourceNotFoundException') {
      // Group does not exist yet – create it.
      await cognitoClient.send(
        new CreateGroupCommand({
          UserPoolId: USER_POOL_ID,
          GroupName: familyId.trim(),
          Description: `Tenant isolation group for family ${familyId.trim()}`,
        })
      );
    } else {
      throw err;
    }
  }

  // ── 4. Add the caller to the family Cognito group ──────────────────────────
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: callerUsername,
      GroupName: familyId.trim(),
    })
  );

  return { success: true, familyId: familyId.trim() };
};
