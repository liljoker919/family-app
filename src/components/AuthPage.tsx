import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import { amplifyConfig } from '../amplifyconfiguration';

Amplify.configure(amplifyConfig);

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-royal-blue-900 via-royal-blue-700 to-royal-blue-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Family App</h1>
          <p className="text-royal-blue-100">Sign in to access your family dashboard</p>
        </div>
        <Authenticator
          className="shadow-2xl rounded-lg"
          formFields={{
            signIn: {
              username: {
                label: 'Email',
                placeholder: 'Enter your email',
              },
            },
            signUp: {
              email: {
                label: 'Email',
                placeholder: 'Enter your email',
                order: 1,
              },
              password: {
                label: 'Password',
                placeholder: 'Enter your password',
                order: 2,
              },
              confirm_password: {
                label: 'Confirm Password',
                placeholder: 'Confirm your password',
                order: 3,
              },
              given_name: {
                label: 'First Name',
                placeholder: 'Enter your first name',
                order: 4,
              },
              family_name: {
                label: 'Last Name',
                placeholder: 'Enter your last name',
                order: 5,
              },
            },
          }}
        >
          {({ signOut, user }) => {
            if (user) {
              window.location.href = '/dashboard';
            }
            return null;
          }}
        </Authenticator>
      </div>
    </div>
  );
}
