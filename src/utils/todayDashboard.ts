import { isRegistrationExpired, isRegistrationExpiringSoon } from './registrationExpiry';
import { isChoreToday, localDayAbbrev } from './choresDue';

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
  title?: string | null;
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

export interface TodayPriorityAlert {
  id: string;
  type: 'chore' | 'car' | 'vacation';
  module: 'chores' | 'cars' | 'vacations';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  daysUntil: number;
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

function getUtcDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (1000 * 60 * 60 * 24);
}

export function getClosestVacationCountdown(vacations: VacationDashboardItem[], today: Date = new Date()): {
  id: string;
  title: string;
  daysUntil: number;
  startDate: string;
} | null {
  const todayDayNumber = getUtcDayNumber(today);

  const upcoming = vacations
    .filter((vacation) => !!vacation.startDate)
    .map((vacation) => {
      const startDate = vacation.startDate as string;
      const start = new Date(`${startDate}T00:00:00`);
      const daysUntil = getUtcDayNumber(start) - todayDayNumber;
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

export function countChoresDueInNext24Hours(chores: ChoreDashboardItem[], now: Date = new Date()): number {
  return chores.filter((chore) => isChoreDueInNext24Hours(chore, now)).length;
}

function isChoreDueInNext24Hours(chore: ChoreDashboardItem, now: Date): boolean {
  if (chore.isActive === false) return false;
  if (chore.recurrence === 'DAILY') return true;
  if (chore.recurrence !== 'WEEKLY') return false;

  const days = (chore.daysOfWeek ?? []).filter(Boolean) as string[];
  if (days.length === 0) return false;

  const today = localDayAbbrev(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = localDayAbbrev(tomorrowDate);
  return days.includes(today) || days.includes(tomorrow);
}

function toLocalDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalDate(dateIso: string): Date {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDayDiffFromToday(dateIso: string, now: Date): number {
  const target = toLocalDate(dateIso);
  const today = toLocalDayStart(now);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTodayPrioritizedAlerts(
  cars: CarDashboardItem[],
  vacations: VacationDashboardItem[],
  chores: ChoreDashboardItem[],
  now: Date = new Date()
): TodayPriorityAlert[] {
  const alerts: (TodayPriorityAlert & { priority: number })[] = [];

  for (const car of cars) {
    if (!car.registrationExpiry) continue;
    const daysUntil = getDayDiffFromToday(car.registrationExpiry, now);
    const expired = isRegistrationExpired(car.registrationExpiry, now);
    const expiringSoon = isRegistrationExpiringSoon(car.registrationExpiry, now) && daysUntil < 30;
    if (!expired && !expiringSoon) continue;

    const label = [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Vehicle';
    alerts.push({
      id: `car-${car.id}`,
      type: 'car',
      module: 'cars',
      severity: expired ? 'critical' : 'warning',
      title: expired ? `${label} registration expired` : `${label} registration due soon`,
      detail: `Registration date: ${car.registrationExpiry}`,
      daysUntil,
      priority: expired ? 0 : 2,
    });
  }

  for (const chore of chores) {
    if (!isChoreDueInNext24Hours(chore, now)) continue;
    alerts.push({
      id: `chore-${chore.id}`,
      type: 'chore',
      module: 'chores',
      severity: 'warning',
      title: chore.title || 'Chore due in the next 24 hours',
      detail: 'Mark this chore done before the next day rolls over.',
      daysUntil: 0,
      priority: 1,
    });
  }

  for (const vacation of vacations) {
    if (!vacation.startDate) continue;
    const daysUntil = getDayDiffFromToday(vacation.startDate, now);
    if (daysUntil < 0 || daysUntil >= 14) continue;
    alerts.push({
      id: `vacation-${vacation.id}`,
      type: 'vacation',
      module: 'vacations',
      severity: 'info',
      title: `${vacation.title || 'Upcoming vacation'} starts soon`,
      detail: `Starts ${vacation.startDate}`,
      daysUntil,
      priority: 3,
    });
  }

  return alerts
    .sort((a, b) => a.priority - b.priority || a.daysUntil - b.daysUntil || a.title.localeCompare(b.title))
    .map(({ priority, ...alert }) => alert);
}
