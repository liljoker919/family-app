type BackendWithOptionalAuth = {
  auth?: {
    resources: {
      userPool: {
        userPoolId: string;
      };
    };
  };
};

export const buildAuthResourceMap = <TAuthResource>(
  includeAuth: boolean,
  authResource: TAuthResource,
) => (includeAuth ? { auth: authResource } : {});

export const getUserPoolId = (backend: BackendWithOptionalAuth): string | undefined =>
  backend.auth?.resources.userPool.userPoolId;
