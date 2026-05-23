import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from '../functions/post-confirmation/resource';
import { preSignUp } from '../functions/pre-sign-up/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['ADMIN', 'PLANNER', 'MEMBER'],
  userAttributes: {
    familyName: {
      mutable: true,
    },
    givenName: {
      mutable: true,
    },
  },
  triggers: {
    preSignUp,
    postConfirmation,
  },
});
