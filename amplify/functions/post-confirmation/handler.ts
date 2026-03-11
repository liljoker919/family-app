import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // Only create profile for new user sign-ups, not admin confirmations
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const { userName, userPoolId, request } = event;
  const { userAttributes } = request;

  const email = userAttributes['email'];
  // If ADMIN_EMAILS is set (comma-separated), matching users get ADMIN — everyone else gets MEMBER
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const group = adminEmails.includes(email) ? 'ADMIN' : 'MEMBER';

  // Add user to their Cognito group so RBAC rules apply immediately
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: userName,
      GroupName: group,
    }),
  );

  return event;
};
