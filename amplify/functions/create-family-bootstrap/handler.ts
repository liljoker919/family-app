import type { AppSyncResolverHandler } from 'aws-lambda';
import { randomInt, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

const FAMILY_TABLE_NAME = process.env.FAMILY_TABLE_NAME!;
const FAMILY_MEMBER_TABLE_NAME = process.env.FAMILY_MEMBER_TABLE_NAME!;

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[randomInt(0, JOIN_CODE_CHARS.length)];
  }
  return code;
}

interface CreateFamilyBootstrapArgs {
  name: string;
  displayName?: string | null;
}

interface CreateFamilyBootstrapResult {
  familyId: string;
  familyName: string;
  joinCode: string;
  role: 'ADMIN';
}

export const handler: AppSyncResolverHandler<
  CreateFamilyBootstrapArgs,
  CreateFamilyBootstrapResult
> = async (event) => {
  const identity = event.identity as Record<string, any> | null;
  const userId = identity?.username ?? identity?.claims?.email ?? null;
  if (!userId) {
    throw new Error('Unauthorized: No identity found.');
  }

  const familyName = event.arguments.name?.trim();
  if (!familyName) {
    throw new Error('Family name is required.');
  }

  const familyId = randomUUID();
  const memberId = randomUUID();
  const joinCode = generateJoinCode();
  const now = new Date().toISOString();
  const displayName = event.arguments.displayName?.trim() || null;

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: FAMILY_TABLE_NAME,
            Item: {
              id: familyId,
              name: familyName,
              joinCode,
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
              __typename: 'Family',
            },
            ConditionExpression: 'attribute_not_exists(id)',
          },
        },
        {
          Put: {
            TableName: FAMILY_MEMBER_TABLE_NAME,
            Item: {
              id: memberId,
              familyId,
              userId,
              role: 'ADMIN',
              displayName,
              createdAt: now,
              updatedAt: now,
              __typename: 'FamilyMember',
            },
            ConditionExpression: 'attribute_not_exists(id)',
          },
        },
      ],
    })
  );

  return {
    familyId,
    familyName,
    joinCode,
    role: 'ADMIN',
  };
};
