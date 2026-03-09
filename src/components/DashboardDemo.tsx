import { useState } from 'react';

type ActiveModule = 'vacations' | 'property' | 'cars' | 'calendar';

export default function DashboardDemo() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('vacations');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-royal-blue-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Family Dashboard</h1>
              <p className="text-royal-blue-200 text-sm">Welcome, Family Member</p>
            </div>
            <button className="bg-royal-blue-600 hover:bg-royal-blue-800 px-4 py-2 rounded-lg transition">
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Vacations
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Calendar
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeModule === 'vacations' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Vacations</h2>
                <button className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition">
                  Add Vacation
                </button>
              </div>

              {/* Sample Vacation Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Summer Beach Vacation 2026</h3>
                    <p className="text-gray-600 mt-1">Relaxing family trip to the coast</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span>📅 2026-07-15 - 2026-07-22</span>
                      <span>✈️ flight</span>
                      <span>🏨 Beachside Resort</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm">
                      View Activities
                    </button>
                    <button className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Sample Activity */}
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold mb-4">Activities</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-semibold text-gray-800">Beach Day</h5>
                        <p className="text-sm text-gray-600 mt-1">Swimming and sandcastle building</p>
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          <span>📅 2026-07-16</span>
                          <span>📍 Main Beach</span>
                        </div>
                      </div>
                      <button className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-3 py-1 rounded text-xs">
                        Feedback
                      </button>
                    </div>

                    {/* Sample Feedback */}
                    <div className="mt-4 border-t pt-4">
                      <h6 className="font-medium text-sm mb-3">Activity Ratings</h6>
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="flex gap-1 mb-1">
                          <span className="text-yellow-500">⭐⭐⭐⭐⭐</span>
                        </div>
                        <p className="text-sm text-gray-700">Amazing day! The kids loved it!</p>
                        <p className="text-xs text-gray-500 mt-1">By family@example.com</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModule === 'property' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Property Management</h2>
                <button className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition">
                  Add Property
                </button>
              </div>

              {/* Sample Property Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Family Rental Property</h3>
                    <p className="text-gray-600 mt-1">📍 123 Main Street, Cityville</p>
                    <p className="text-sm text-gray-500 mt-1">Type: Residential</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm">
                      View Transactions
                    </button>
                    <button className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Total Income</p>
                    <p className="text-2xl font-bold text-green-700">$12,500.00</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-700">$3,200.00</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Net Income</p>
                    <p className="text-2xl font-bold text-blue-700">$9,300.00</p>
                  </div>
                </div>

                {/* Sample Transactions */}
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold mb-4">Recent Transactions</h4>
                  <div className="space-y-2">
                    <div className="p-4 rounded-lg border bg-green-50 border-green-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex gap-3 items-center">
                            <span className="font-semibold text-green-700">$2,500.00</span>
                            <span className="text-sm text-gray-600">Monthly Rent Payment</span>
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            <span>📅 2026-02-01</span>
                            <span>🏷️ Rent</span>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          income
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModule === 'cars' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Cars Management</h2>
                <button className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition">
                  Add Car
                </button>
              </div>

              {/* Sample Car Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">2024 Honda Accord</h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">VIN:</span> 1HGBH41JXMN109186
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Color:</span> Silver
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Current Mileage:</span> 15,234 miles
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700 px-4 py-2 rounded-lg transition text-sm">
                      View Service History
                    </button>
                    <button className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition text-sm">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Service History */}
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold mb-4">Service History</h4>
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex gap-3 items-center">
                            <h5 className="font-semibold text-gray-800">Oil Change</h5>
                            <span className="text-sm font-medium text-green-600">$49.99</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Regular maintenance service</p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>📅 2026-02-01</span>
                            <span>📏 15,000 miles</span>
                            <span>🔧 Quick Lube</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModule === 'calendar' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Family Calendar</h2>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-4 p-4 bg-royal-blue-50 border border-royal-blue-200 rounded-lg">
                  <p className="text-royal-blue-800">
                    📅 <strong>Calendar Placeholder:</strong> This calendar will display family events, vacation dates, and important reminders.
                  </p>
                </div>
                <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">FullCalendar integration available in the full version</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
