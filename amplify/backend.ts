import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/post-confirmation/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
});

// Grant the trigger write access to the Profile table
const profileTable = backend.data.resources.tables['Profile'];
profileTable.grantWriteData(backend.postConfirmation.resources.lambda);

// Inject environment variables using the L2 addEnvironment API
backend.postConfirmation.resources.lambda.addEnvironment(
  'PROFILE_TABLE_NAME',
  profileTable.tableName,
);
backend.postConfirmation.resources.lambda.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);

// Grant permission to assign users to Cognito groups
backend.postConfirmation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminAddUserToGroup'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);
