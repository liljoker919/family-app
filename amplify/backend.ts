import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { postConfirmation } from './functions/post-confirmation/resource';

const backend = defineBackend({
  auth,
  data,
  postConfirmation,
});

// Grant the trigger write access to the Profile table and expose the table name
const profileTable = backend.data.resources.tables['Profile'];
profileTable.grantWriteData(backend.postConfirmation.resources.lambda);

// addEnvironment is on the concrete Function class; reach through the L1 construct
backend.postConfirmation.resources.cfnResources.cfnFunction.addPropertyOverride(
  'Environment.Variables.PROFILE_TABLE_NAME',
  profileTable.tableName,
);
