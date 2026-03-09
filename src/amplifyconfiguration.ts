export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.PUBLIC_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.PUBLIC_USER_POOL_CLIENT_ID || '',
      identityPoolId: import.meta.env.PUBLIC_IDENTITY_POOL_ID || '',
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
        family_name: {
          required: false,
        },
        given_name: {
          required: false,
        },
      },
      allowGuestAccess: false,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.PUBLIC_GRAPHQL_ENDPOINT || '',
      region: import.meta.env.PUBLIC_AWS_REGION || 'us-east-1',
      defaultAuthMode: 'userPool',
    },
  },
};
