import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/post-confirmation/resource';
import { updateMemberRoleFn } from './functions/update-member-role/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  updateMemberRoleFn,
});

// Grant permission to assign users to Cognito groups
backend.postConfirmation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminAddUserToGroup'],
    // Use wildcard resource to avoid circular dependency between the user pool
    // (which owns the trigger) and the trigger lambda execution role policy.
    resources: ['*'],
  }),
);

// Grant the role-update Lambda read/write access to the FamilyMember table so
// it can perform caller lookup, admin-count checks, and the role update itself.
backend.data.resources.tables['FamilyMember'].grantReadWriteData(
  backend.updateMemberRoleFn.resources.lambda,
);

// Inject the DynamoDB table name so the handler can reference it at runtime.
backend.updateMemberRoleFn.resources.lambda.addEnvironment(
  'FAMILY_MEMBER_TABLE_NAME',
  backend.data.resources.tables['FamilyMember'].tableName,
);
