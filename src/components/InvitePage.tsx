import { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';
import { redeemInviteToken, parseInviteParams } from '../utils/familyContext';

Amplify.configure(outputs);

const ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Family Member',
  PLANNER: 'Family Planner',
  ADMIN: 'Family Admin',
};

export default function InvitePage() {
  const [params, setParams] = useState<{
    token: string | null;
    email: string | null;
    role: string | null;
    family: string | null;
  }>({ token: null, email: null, role: null, family: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setParams(parseInviteParams(window.location.search));
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-royal-blue-900 via-royal-blue-700 to-royal-blue-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Invite header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">👨‍👩‍👧‍👦</div>
          <h1 className="text-3xl font-bold text-white mb-1">You're Invited!</h1>
          {params.family ? (
            <p className="text-royal-blue-100">
              Join{' '}
              <span className="font-semibold text-white">{params.family}</span>
              {params.role && ROLE_LABELS[params.role] && (
                <span className="text-royal-blue-200"> as a {ROLE_LABELS[params.role]}</span>
              )}
            </p>
          ) : (
            <p className="text-royal-blue-100">Sign up to join your family</p>
          )}
        </div>

        {!loaded ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500">Loading invite…</p>
          </div>
        ) : !params.token ? (
          <InvalidInvite />
        ) : (
          <InviteAuthFlow
            token={params.token}
            email={params.email}
          />
        )}
      </div>
    </div>
  );
}

function InvalidInvite() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
      <div className="text-5xl mb-4">🔗</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Invalid Invite Link</h2>
      <p className="text-gray-500 mb-6">
        This invite link is missing required information. Please ask the family admin to resend the
        invite.
      </p>
      <a
        href="/"
        className="inline-block bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-semibold py-2 px-6 rounded-xl transition"
      >
        Go to Sign In
      </a>
    </div>
  );
}

interface InviteAuthFlowProps {
  token: string;
  email: string | null;
}

function InviteAuthFlow({ token, email }: InviteAuthFlowProps) {
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const formFields = {
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
        ...(email ? { defaultValue: email } : {}),
      },
      password: {
        label: 'Password',
        placeholder: 'Create a password',
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
  };

  const handleAuthenticated = async (user: any) => {
    if (!user || redeeming) return;
    setRedeeming(true);
    setRedeemError(null);

    try {
      // Redeem the invite token to link this user to the family.
      await redeemInviteToken(token);
      // Redirect to dashboard — family membership is now established.
      window.location.href = '/dashboard';
    } catch (err: any) {
      setRedeemError(err.message ?? 'Failed to redeem invite. Please contact the family admin.');
      setRedeeming(false);
    }
  };

  return (
    <div>
      {redeemError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <strong>Error:</strong> {redeemError}
          <div className="mt-2">
            <a href="/dashboard" className="underline hover:no-underline">
              Go to dashboard
            </a>
          </div>
        </div>
      )}

      {redeeming && (
        <div className="mb-4 p-4 bg-royal-blue-50 border border-royal-blue-200 rounded-xl text-royal-blue-700 text-sm text-center">
          Linking you to your family…
        </div>
      )}

      <Authenticator
        className="shadow-2xl rounded-lg"
        initialState="signUp"
        formFields={formFields}
      >
        {({ user }) => {
          if (user && !redeeming && !redeemError) {
            handleAuthenticated(user);
          }
          return (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-gray-600">Signed in. Linking you to your family…</p>
            </div>
          );
        }}
      </Authenticator>
    </div>
  );
}


function InvalidInvite() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
      <div className="text-5xl mb-4">🔗</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Invalid Invite Link</h2>
      <p className="text-gray-500 mb-6">
        This invite link is missing required information. Please ask the family admin to resend the
        invite.
      </p>
      <a
        href="/"
        className="inline-block bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-semibold py-2 px-6 rounded-xl transition"
      >
        Go to Sign In
      </a>
    </div>
  );
}

interface InviteAuthFlowProps {
  token: string;
  email: string | null;
}

function InviteAuthFlow({ token, email }: InviteAuthFlowProps) {
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const formFields = {
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
        ...(email ? { defaultValue: email } : {}),
      },
      password: {
        label: 'Password',
        placeholder: 'Create a password',
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
  };

  const handleAuthenticated = async (user: any) => {
    if (!user || redeeming) return;
    setRedeeming(true);
    setRedeemError(null);

    try {
      // Redeem the invite token to link this user to the family.
      await redeemInviteToken(token);
      // Redirect to dashboard — family membership is now established.
      window.location.href = '/dashboard';
    } catch (err: any) {
      setRedeemError(err.message ?? 'Failed to redeem invite. Please contact the family admin.');
      setRedeeming(false);
    }
  };

  return (
    <div>
      {redeemError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <strong>Error:</strong> {redeemError}
          <div className="mt-2">
            <a href="/dashboard" className="underline hover:no-underline">
              Go to dashboard
            </a>
          </div>
        </div>
      )}

      {redeeming && (
        <div className="mb-4 p-4 bg-royal-blue-50 border border-royal-blue-200 rounded-xl text-royal-blue-700 text-sm text-center">
          Linking you to your family…
        </div>
      )}

      <Authenticator
        className="shadow-2xl rounded-lg"
        initialState="signUp"
        formFields={formFields}
      >
        {({ user }) => {
          if (user && !redeeming && !redeemError) {
            handleAuthenticated(user);
          }
          return (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-gray-600">Signed in. Linking you to your family…</p>
            </div>
          );
        }}
      </Authenticator>
    </div>
  );
}
