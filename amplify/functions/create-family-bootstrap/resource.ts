import { defineFunction } from '@aws-amplify/backend';

export const createFamilyBootstrapFn = defineFunction({
  name: 'create-family-bootstrap',
  entry: './handler.ts',
  resourceGroupName: 'data',
});
