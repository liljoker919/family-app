import { useState, useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';
import VacationsModule from './modules/VacationsModule';
import PropertyModule from './modules/PropertyModule';
import CarsModule from './modules/CarsModule';
import CalendarModule from './modules/CalendarModule';
import PlanningModule from './modules/PlanningModule';
import CookbookModule from './modules/CookbookModule';

Amplify.configure(outputs);

type ActiveModule = 'vacations' | 'planning' | 'property' | 'cars' | 'calendar' | 'cookbook';

export default function Dashboard() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('vacations');

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-royal-blue-700 text-white shadow-lg">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Family Dashboard</h1>
                  <p className="text-royal-blue-200 text-sm">
                    Welcome, {user?.signInDetails?.loginId || 'Family Member'}
                  </p>
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
                </ul>
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
              {activeModule === 'vacations' && <VacationsModule user={user} />}
              {activeModule === 'planning' && <PlanningModule user={user} />}
              {activeModule === 'property' && <PropertyModule user={user} />}
              {activeModule === 'cars' && <CarsModule user={user} />}
              {activeModule === 'calendar' && <CalendarModule />}
              {activeModule === 'cookbook' && <CookbookModule user={user} />}
            </main>
          </div>
        </div>
      )}
    </Authenticator>
  );
}
