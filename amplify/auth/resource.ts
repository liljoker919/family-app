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
      required: false,
    },
    givenName: {
      mutable: true,
      required: false,
    },
  },
  triggers: {
    postConfirmation,
  },
});
