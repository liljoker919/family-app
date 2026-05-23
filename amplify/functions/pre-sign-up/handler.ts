import type { PreSignUpTriggerHandler } from 'aws-lambda';

const requiredNameError = 'First and last name are required.';

export const handler: PreSignUpTriggerHandler = async (event) => {
  const givenName = event.request.userAttributes?.given_name?.trim();
  const familyName = event.request.userAttributes?.family_name?.trim();

  if (!givenName || !familyName) {
    throw new Error(requiredNameError);
  }

  return event;
};
