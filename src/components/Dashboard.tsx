import { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';
import VacationsModule from './modules/VacationsModule';
import PropertyModule from './modules/PropertyModule';
import CarsModule from './modules/CarsModule';
import CalendarModule from './modules/CalendarModule';
import PlanningModule from './modules/PlanningModule';
import CookbookModule from './modules/CookbookModule';
import ChoresModule from './modules/ChoresModule';
import ReportingModule from './modules/ReportingModule';
import AdminModule from './modules/AdminModule';
import FamilySetup from './FamilySetup';
import type { ActiveModule } from '../utils/dashboardModules';
import { canAccessModule } from '../utils/dashboardModules';
import { getFamilyMembership } from '../utils/familyContext';
import type { FamilyMembership } from '../utils/familyContext';

Amplify.configure(outputs);

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
};

function DashboardContent() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('vacations');

  return (
    <Authenticator formFields={formFields}>
      {({ signOut, user }) => (
        <DashboardInner user={user} signOut={signOut} activeModule={activeModule} setActiveModule={setActiveModule} />
      )}
    </Authenticator>
  );
}

interface DashboardInnerProps {
  user: any;
  signOut: (() => void) | undefined;
  activeModule: ActiveModule;
  setActiveModule: (m: ActiveModule) => void;
}

function DashboardInner({ user, signOut, activeModule, setActiveModule }: DashboardInnerProps) {
  const [membership, setMembership] = useState<FamilyMembership | null | undefined>(undefined);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const userId = user?.signInDetails?.loginId ?? user?.userId ?? '';

  useEffect(() => {
    if (userId) {
      getFamilyMembership(userId).then(setMembership);
    }
  }, [userId]);

  // Still loading family membership
  if (membership === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  // User has no family yet — show onboarding
  if (membership === null) {
    return (
      <FamilySetup
        userId={userId}
        onComplete={(m) => setMembership(m)}
        onSignOut={signOut}
      />
    );
  }

  const familyId = membership.familyId;
  const canShareJoinCode = membership.role === 'ADMIN' && !!membership.familyJoinCode;

  const handleCopyJoinCode = async () => {
    if (!membership.familyJoinCode) return;

    try {
      await navigator.clipboard.writeText(membership.familyJoinCode);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }

    window.setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-royal-blue-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Family Dashboard</h1>
              <p className="text-royal-blue-200 text-sm">
                Welcome, {user?.signInDetails?.loginId || 'Family Member'}
                {membership.familyName && (
                  <span className="ml-2 text-royal-blue-300">· {membership.familyName}</span>
                )}
              </p>
              {canShareJoinCode && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-royal-blue-200">Family Code:</span>
                  <span className="font-mono tracking-wider bg-royal-blue-800 px-2 py-1 rounded">
                    {membership.familyJoinCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyJoinCode}
                    className="bg-royal-blue-600 hover:bg-royal-blue-800 px-2 py-1 rounded transition"
                  >
                    Copy
                  </button>
                  {copyStatus === 'copied' && <span className="text-emerald-200">Copied</span>}
                  {copyStatus === 'error' && <span className="text-amber-200">Copy failed</span>}
                </div>
              )}
            </div>
            <button
              onClick={signOut}
              className="bg-royal-blue-600 hover:bg-royal-blue-800 px-4 py-2 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white shadow-lg min-h-screen">
          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setActiveModule('vacations')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'vacations'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Vacations
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModule('planning')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'planning'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Trip Planning
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModule('property')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'property'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Property
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModule('cars')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'cars'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Cars
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModule('calendar')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'calendar'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Calendar
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModule('cookbook')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'cookbook'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Cookbook
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModule('chores')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'chores'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Chores
                  </span>
                </button>
              </li>
              {canAccessModule('reporting', membership.role) && (
              <li>
                <button
                  onClick={() => setActiveModule('reporting')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition ${
                    activeModule === 'reporting'
                      ? 'bg-royal-blue-600 text-white'
                      : 'text-gray-700 hover:bg-royal-blue-50'
                  }`}
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Reporting
                  </span>
                </button>
              </li>
              )}
              {canAccessModule('admin', membership.role) && (
                <li>
                  <button
                    onClick={() => setActiveModule('admin')}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      activeModule === 'admin'
                        ? 'bg-royal-blue-600 text-white'
                        : 'text-gray-700 hover:bg-royal-blue-50'
                    }`}
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Admin
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {!canAccessModule(activeModule, membership.role) ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-600 mb-2">Access Restricted</h2>
              <p className="text-gray-500">You do not have permission to view this module.</p>
            </div>
          ) : (
            <>
          {activeModule === 'vacations' && <VacationsModule user={user} familyId={familyId} />}
          {activeModule === 'planning' && <PlanningModule user={user} familyId={familyId} />}
          {activeModule === 'property' && <PropertyModule user={user} familyId={familyId} />}
          {activeModule === 'cars' && <CarsModule user={user} familyId={familyId} />}
          {activeModule === 'calendar' && <CalendarModule />}
          {activeModule === 'cookbook' && <CookbookModule user={user} familyId={familyId} />}
          {activeModule === 'chores' && <ChoresModule user={user} familyId={familyId} role={membership.role} />}
          {activeModule === 'reporting' && <ReportingModule user={user} familyId={familyId} />}
          {activeModule === 'admin' && <AdminModule user={user} familyId={familyId} membership={membership} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
