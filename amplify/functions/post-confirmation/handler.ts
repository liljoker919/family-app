import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // Only create profile for new user sign-ups, not admin confirmations
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const { userName, request } = event;
  const { userAttributes } = request;

  const email = userAttributes['email'];
  const givenName = userAttributes['given_name'] ?? '';
  const familyName = userAttributes['family_name'] ?? '';

  const displayName =
    givenName || familyName
      ? [givenName, familyName].filter(Boolean).join(' ')
      : email;

  const tableName = process.env.PROFILE_TABLE_NAME;
  if (!tableName) {
    throw new Error('PROFILE_TABLE_NAME environment variable is not set');
  }

  const now = new Date().toISOString();

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: userName,
          userId: userName,
          email,
          displayName,
          role: 'MEMBER',
          createdAt: now,
          updatedAt: now,
        },
        // Prevent overwriting if a profile was somehow already created
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
  } catch (error) {
    // If profile already exists, treat it as a no-op
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
      console.log(`Profile for user ${userName} already exists, skipping creation`);
    } else {
      throw error;
    }
  }

  return event;
};
