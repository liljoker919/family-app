import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/post-confirmation/resource';
import { updateMemberRoleFn } from './functions/update-member-role/resource';
import { createInviteFn } from './functions/create-invite/resource';
import { redeemInviteFn } from './functions/redeem-invite/resource';
import { addToFamilyGroupFn } from './functions/add-to-family-group/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
  updateMemberRoleFn,
  createInviteFn,
  redeemInviteFn,
  addToFamilyGroupFn,
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

// ── addToFamilyGroup Lambda ───────────────────────────────────────────────────
// Grant the addToFamilyGroup Lambda read access to the FamilyMember table so it
// can verify that the caller is a member of the requested family before adding
// them to the corresponding Cognito group.
backend.data.resources.tables['FamilyMember'].grantReadData(
  backend.addToFamilyGroupFn.resources.lambda,
);

// Inject table name and User Pool ID for the addToFamilyGroup Lambda.
backend.addToFamilyGroupFn.resources.lambda.addEnvironment(
  'FAMILY_MEMBER_TABLE_NAME',
  backend.data.resources.tables['FamilyMember'].tableName,
);
backend.addToFamilyGroupFn.resources.lambda.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);

// Grant Cognito group management permissions to the addToFamilyGroup Lambda.
// This allows it to create groups (one per family) and add users to them,
// which satisfies the groupDefinedIn('familyId') authorization rule.
backend.addToFamilyGroupFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'cognito-idp:GetGroup',
      'cognito-idp:CreateGroup',
      'cognito-idp:AdminAddUserToGroup',
    ],
    resources: ['*'],
  }),
);

// Grant the redeemInvite Lambda Cognito group management permissions so it can
// add the newly-onboarded user to their family group during invite redemption,
// completing the tenant-isolation bootstrapping without requiring a separate
// client-side addSelfToFamilyGroup call.
backend.redeemInviteFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'cognito-idp:GetGroup',
      'cognito-idp:CreateGroup',
      'cognito-idp:AdminAddUserToGroup',
    ],
    resources: ['*'],
  }),
);
backend.redeemInviteFn.resources.lambda.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);
