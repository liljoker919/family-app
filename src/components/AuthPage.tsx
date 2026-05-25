import { useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

Amplify.configure(outputs);

type AuthenticatedUser = {
  username?: string;
  [key: string]: unknown;
} | null | undefined;

interface RedirectHandlerProps {
  user: AuthenticatedUser;
}

export function redirectToDashboardIfAuthenticated(
  user: AuthenticatedUser,
  location: Pick<Location, 'assign'> = window.location,
) {
  if (!user) return;
  location.assign('/dashboard');
}

function RedirectHandler({ user }: RedirectHandlerProps) {
  useEffect(() => {
    redirectToDashboardIfAuthenticated(user);
  }, [user]);

  return null;
}

export const authPageFormFields = {
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
      isRequired: true,
    },
    family_name: {
      label: 'Last Name',
      placeholder: 'Enter your last name',
      order: 5,
      isRequired: true,
    },
  },
};

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
          formFields={authPageFormFields}
        >
          {({ user }) => <RedirectHandler user={user} />}
        </Authenticator>
      </div>
    </div>
  );
}
