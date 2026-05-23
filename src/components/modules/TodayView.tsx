import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { ActiveModule } from '../../utils/dashboardModules';
import { canAccessModule } from '../../utils/dashboardModules';
import type { FamilyMembership } from '../../utils/familyContext';
import UpcomingWidget from './UpcomingWidget';
import {
  countChoresDueInNext24Hours,
  getClosestVacationCountdown,
  getCurrentMonthFamilyNetIncome,
  getRecentTransactions,
  getTodayPrioritizedAlerts,
  getUrgentCarRegistrationAlerts,
} from '../../utils/todayDashboard';
import { TODAY_ALERT_SEVERITY_STYLES } from '../../utils/todayAlertStyles';
import { isLikelyFamilyClaimPropagationDelay } from '../../utils/propertyDataRecovery';

const client = generateClient<Schema>();

interface TodayViewProps {
  familyId: string;
  membership: FamilyMembership;
  onNavigateTo: (module: ActiveModule) => void;
}

export default function TodayView({ familyId, membership, onNavigateTo }: TodayViewProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [chores, setChores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewProperty = canAccessModule('property', membership);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const wait = async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      };

      const toErrorMessage = (errors: Array<{ message?: string } | string> = []) =>
        errors
          .map((error) =>
            typeof error === 'string' ? error : error?.message ?? 'Unknown error'
          )
          .join('; ');

      const fetchDashboardData = async () => {
        const [carResult, vacationResult, choreResult, propertyTxnResult] = await Promise.all([
          client.models.Car.list({ filter: { familyId: { eq: familyId } } }),
          client.models.Vacation.list({ filter: { familyId: { eq: familyId } } }),
          client.models.Chore.list({ filter: { familyId: { eq: familyId } } }),
          canViewProperty
            ? client.models.PropertyTransaction.list({ filter: { familyId: { eq: familyId } } })
            : Promise.resolve({ data: [], errors: undefined }),
        ]);

        const listErrors = [
          ...(carResult.errors ?? []),
          ...(vacationResult.errors ?? []),
          ...(choreResult.errors ?? []),
          ...(propertyTxnResult.errors ?? []),
        ];

        if (listErrors.length > 0) {
          throw new Error(toErrorMessage(listErrors));
        }

        if (cancelled) return;

        setCars(carResult.data ?? []);
        setVacations(vacationResult.data ?? []);
        setChores(choreResult.data ?? []);
        setTransactions(propertyTxnResult.data ?? []);
      };

      try {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await fetchDashboardData();
            return;
          } catch (error) {
            if (attempt < maxAttempts && isLikelyFamilyClaimPropagationDelay(error)) {
              await wait(300 * attempt);
              continue;
            }

            console.error('Failed to load Today view dashboard data', error);
            if (!cancelled) {
              setCars([]);
              setVacations([]);
              setChores([]);
              setTransactions([]);
            }
            return;
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId, canViewProperty]);

  const carAlerts = getUrgentCarRegistrationAlerts(cars, new Date());
  const todayAlerts = getTodayPrioritizedAlerts(cars, vacations, chores, new Date());
  const monthlyNetIncome = getCurrentMonthFamilyNetIncome(transactions, new Date());
  const recentTransactions = getRecentTransactions(transactions, 5);
  const closestVacation = getClosestVacationCountdown(vacations, new Date());
  const choresDueNext24h = countChoresDueInNext24Hours(chores, new Date());

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigateTo('vacations')}
            className="rounded-lg bg-royal-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-royal-blue-700"
          >
            Add Activity
          </button>
          <button
            type="button"
            onClick={() => onNavigateTo('chores')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Mark Chore Done
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-800">Today Alerts</h2>
        {loading ? (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-base font-semibold text-gray-800">Loading today’s alerts...</p>
            <p className="mt-1 text-sm text-gray-600">Checking your 24h / 30d / 14d windows.</p>
          </div>
        ) : todayAlerts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-base font-semibold text-gray-800">No items for today</p>
            <p className="mt-1 text-sm text-gray-600">Everything in your 24h / 30d / 14d windows looks clear.</p>
            <button
              type="button"
              onClick={() => onNavigateTo('calendar')}
              className="mt-3 rounded-md border border-royal-blue-200 px-3 py-1.5 text-sm font-medium text-royal-blue-700 hover:bg-royal-blue-50"
            >
              Plan upcoming tasks
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {todayAlerts.map((alert) => (
              <li key={alert.id} className={`rounded-lg border p-4 ${TODAY_ALERT_SEVERITY_STYLES[alert.severity]}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide">{alert.severity}</p>
                    <p className="mt-1 font-semibold">{alert.title}</p>
                    <p className="mt-1 text-sm">{alert.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTo(alert.module)}
                    className="rounded-md bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigateTo('cars')}
          className="rounded-xl bg-white p-5 text-left shadow transition hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>Cars</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">{cars.length}</p>
          <p className="mt-1 text-sm text-gray-500">{carAlerts.length} urgent registration alert{carAlerts.length === 1 ? '' : 's'}</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTo('vacations')}
          className="rounded-xl bg-white p-5 text-left shadow transition hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>Vacations</p>
          {closestVacation ? (
            <>
              <p className="mt-2 text-xl font-bold text-gray-800">Days Until {closestVacation.title}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{closestVacation.daysUntil}</p>
              <p className="mt-1 text-sm text-gray-500">Starts {closestVacation.startDate}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No upcoming trips</p>
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTo('chores')}
          className="rounded-xl bg-white p-5 text-left shadow transition hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>Chores</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">{choresDueNext24h}</p>
          <p className="mt-1 text-sm text-gray-500">Due in next 24 hours</p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">💵 Family Net Income (This Month)</h2>
            {canViewProperty && (
              <button
                type="button"
                onClick={() => onNavigateTo('property')}
                className="text-sm hover:underline"
                style={{ color: '#1D4ED8' }}
              >
                View Property →
              </button>
            )}
          </div>

          {!canViewProperty ? (
            <p className="text-sm text-gray-500">Property summary is available to family admins.</p>
          ) : loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <p className={`text-3xl font-bold ${monthlyNetIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {monthlyNetIncome >= 0 ? '+' : ''}${monthlyNetIncome.toFixed(2)}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">🧾 Recent Transactions</h2>
          {!canViewProperty ? (
            <p className="text-sm text-gray-500">Property summary is available to family admins.</p>
          ) : loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentTransactions.map((txn) => (
                <li key={txn.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{txn.description || txn.category || 'Transaction'}</p>
                    <p className="text-xs text-gray-500">{txn.date}</p>
                  </div>
                  <span className={`text-sm font-semibold ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.type === 'income' ? '+' : '-'}${(txn.amount ?? 0).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <UpcomingWidget familyId={familyId} onNavigateTo={onNavigateTo} />
    </div>
  );
}
