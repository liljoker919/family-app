import { isRegistrationExpired, isRegistrationExpiringSoon } from './registrationExpiry';
import { isChoreToday } from './choresDue';

export interface CarDashboardItem {
  id: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  registrationExpiry?: string | null;
}

export interface PropertyTransactionDashboardItem {
  id: string;
  type?: 'income' | 'expense' | null;
  amount?: number | null;
  description?: string | null;
  date?: string | null;
  category?: string | null;
}

export interface VacationDashboardItem {
  id: string;
  title?: string | null;
  startDate?: string | null;
}

export interface ChoreDashboardItem {
  id: string;
  recurrence?: string | null;
  daysOfWeek?: (string | null)[] | null;
  isActive?: boolean | null;
}

export interface CarUrgencyAlert {
  id: string;
  label: string;
  registrationExpiry: string;
  severity: 'expired' | 'expiringSoon';
}

export function getUrgentCarRegistrationAlerts(cars: CarDashboardItem[], today: Date = new Date()): CarUrgencyAlert[] {
  return cars
    .filter((car) => !!car.registrationExpiry)
    .map((car) => {
      const registrationExpiry = car.registrationExpiry as string;
      const severity = isRegistrationExpired(registrationExpiry, today)
        ? 'expired'
        : isRegistrationExpiringSoon(registrationExpiry, today)
        ? 'expiringSoon'
        : null;

      if (!severity) return null;

      const label = [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Vehicle';
      return {
        id: car.id,
        label,
        registrationExpiry,
        severity,
      } as CarUrgencyAlert;
    })
    .filter((item): item is CarUrgencyAlert => item !== null)
    .sort((a, b) => a.registrationExpiry.localeCompare(b.registrationExpiry));
}

export function getCurrentMonthFamilyNetIncome(
  transactions: PropertyTransactionDashboardItem[],
  today: Date = new Date()
): number {
  const month = today.getMonth();
  const year = today.getFullYear();

  return transactions
    .filter((txn) => {
      if (!txn.date) return false;
      const txnDate = new Date(`${txn.date}T00:00:00`);
      return txnDate.getFullYear() === year && txnDate.getMonth() === month;
    })
    .reduce((sum, txn) => {
      const amount = txn.amount ?? 0;
      if (txn.type === 'income') return sum + amount;
      if (txn.type === 'expense') return sum - amount;
      return sum;
    }, 0);
}

export function getRecentTransactions(
  transactions: PropertyTransactionDashboardItem[],
  limit = 5
): PropertyTransactionDashboardItem[] {
  return [...transactions]
    .filter((txn) => !!txn.date)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, limit);
}

export function getClosestVacationCountdown(vacations: VacationDashboardItem[], today: Date = new Date()): {
  id: string;
  title: string;
  daysUntil: number;
  startDate: string;
} | null {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = vacations
    .filter((vacation) => !!vacation.startDate)
    .map((vacation) => {
      const startDate = vacation.startDate as string;
      const start = new Date(`${startDate}T00:00:00`);
      const daysUntil = Math.floor((start.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: vacation.id,
        title: vacation.title || 'Upcoming Trip',
        daysUntil,
        startDate,
      };
    })
    .filter((vacation) => vacation.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return upcoming[0] ?? null;
}

export function countChoresDueToday(chores: ChoreDashboardItem[], today: Date = new Date()): number {
  return chores.filter((chore) => isChoreToday(chore, today)).length;
}
