import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from '../functions/post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['ADMIN', 'PLANNER', 'MEMBER'],
  userAttributes: {
    familyName: {
      mutable: true,
      required: true,
    },
    givenName: {
      mutable: true,
      required: true,
    },
  },
  triggers: {
    postConfirmation,
  },
});
