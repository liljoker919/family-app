import { defineFunction } from '@aws-amplify/backend';

export const addToFamilyGroupFn = defineFunction({
  name: 'add-to-family-group',
  entry: './handler.ts',
});
