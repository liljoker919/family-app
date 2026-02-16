import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
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
});
