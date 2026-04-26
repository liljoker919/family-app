import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/post-confirmation/resource';
import { updateMemberRoleFn } from './functions/update-member-role/resource';
import { createInviteFn } from './functions/create-invite/resource';
import { redeemInviteFn } from './functions/redeem-invite/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  updateMemberRoleFn,
  createInviteFn,
  redeemInviteFn,
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

// Grant the createInvite Lambda read/write access to the Invite table so it
// can persist new invite records.
backend.data.resources.tables['Invite'].grantReadWriteData(
  backend.createInviteFn.resources.lambda,
);

// Inject the Invite table name so the handler can reference it at runtime.
backend.createInviteFn.resources.lambda.addEnvironment(
  'INVITE_TABLE_NAME',
  backend.data.resources.tables['Invite'].tableName,
);

// Grant the createInvite Lambda read access to the Family table so it can
// embed the family name in the invite URL for UX pre-population.
backend.data.resources.tables['Family'].grantReadData(
  backend.createInviteFn.resources.lambda,
);

// Inject the Family table name so the createInvite handler can fetch family metadata.
backend.createInviteFn.resources.lambda.addEnvironment(
  'FAMILY_TABLE_NAME',
  backend.data.resources.tables['Family'].tableName,
);

// Grant the redeemInvite Lambda access to the Invite, FamilyMember, and Family
// tables so it can validate the token, provision the user, and return family info.
backend.data.resources.tables['Invite'].grantReadWriteData(
  backend.redeemInviteFn.resources.lambda,
);
backend.data.resources.tables['FamilyMember'].grantReadWriteData(
  backend.redeemInviteFn.resources.lambda,
);
backend.data.resources.tables['Family'].grantReadData(
  backend.redeemInviteFn.resources.lambda,
);

// Inject table names for the redeemInvite Lambda.
backend.redeemInviteFn.resources.lambda.addEnvironment(
  'INVITE_TABLE_NAME',
  backend.data.resources.tables['Invite'].tableName,
);
backend.redeemInviteFn.resources.lambda.addEnvironment(
  'FAMILY_MEMBER_TABLE_NAME',
  backend.data.resources.tables['FamilyMember'].tableName,
);
backend.redeemInviteFn.resources.lambda.addEnvironment(
  'FAMILY_TABLE_NAME',
  backend.data.resources.tables['Family'].tableName,
);
