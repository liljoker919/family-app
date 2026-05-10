import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { ActiveModule } from '../../utils/dashboardModules';
import { canAccessModule } from '../../utils/dashboardModules';
import type { FamilyMembership } from '../../utils/familyContext';
import UpcomingWidget from './UpcomingWidget';
import {
  countChoresDueToday,
  getClosestVacationCountdown,
  getCurrentMonthFamilyNetIncome,
  getRecentTransactions,
  getUrgentCarRegistrationAlerts,
} from '../../utils/todayDashboard';

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
      try {
        const requests: Promise<any>[] = [
          client.models.Car.list({ filter: { familyId: { eq: familyId } } }),
          client.models.Vacation.list({ filter: { familyId: { eq: familyId } } }),
          client.models.Chore.list({ filter: { familyId: { eq: familyId } } }),
        ];

        if (canViewProperty) {
          requests.push(client.models.PropertyTransaction.list({ filter: { familyId: { eq: familyId } } }));
        }

        const [carResult, vacationResult, choreResult, propertyTxnResult] = await Promise.allSettled(requests);

        if (cancelled) return;

        if (carResult.status === 'rejected') {
          console.error('Failed to load cars for Today view', carResult.reason);
        }
        if (vacationResult.status === 'rejected') {
          console.error('Failed to load vacations for Today view', vacationResult.reason);
        }
        if (choreResult.status === 'rejected') {
          console.error('Failed to load chores for Today view', choreResult.reason);
        }
        if (propertyTxnResult?.status === 'rejected') {
          console.error('Failed to load property transactions for Today view', propertyTxnResult.reason);
        }

        setCars(carResult.status === 'fulfilled' ? (carResult.value?.data ?? []) : []);
        setVacations(vacationResult.status === 'fulfilled' ? (vacationResult.value?.data ?? []) : []);
        setChores(choreResult.status === 'fulfilled' ? (choreResult.value?.data ?? []) : []);
        setTransactions(
          propertyTxnResult?.status === 'fulfilled' ? (propertyTxnResult.value?.data ?? []) : []
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId, canViewProperty]);

  const carAlerts = getUrgentCarRegistrationAlerts(cars, new Date());
  const hasExpiredCar = carAlerts.some((alert) => alert.severity === 'expired');
  const monthlyNetIncome = getCurrentMonthFamilyNetIncome(transactions, new Date());
  const recentTransactions = getRecentTransactions(transactions, 5);
  const closestVacation = getClosestVacationCountdown(vacations, new Date());
  const choresDueToday = countChoresDueToday(chores, new Date());

  return (
    <div className="space-y-6">
      {carAlerts.length > 0 && (
        <div
          className="rounded-xl p-4 text-white shadow"
          style={{ backgroundColor: hasExpiredCar ? '#FB7185' : '#F59E0B' }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">🚗 Expired / Expiring Tags</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {carAlerts.map((alert) => (
                  <li key={alert.id}>
                    • {alert.label} — {alert.registrationExpiry}{' '}
                    {alert.severity === 'expired' ? '(Expired)' : '(Expiring soon)'}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTo('cars')}
              className="self-start rounded-md bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
            >
              Open Cars →
            </button>
          </div>
        </div>
      )}

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
          <p className="mt-2 text-2xl font-bold text-gray-800">{choresDueToday}</p>
          <p className="mt-1 text-sm text-gray-500">Due today</p>
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
