import { describe, expect, it } from 'vitest';
import {
  countChoresDueInNext24Hours,
  countChoresDueToday,
  getClosestVacationCountdown,
  getCurrentMonthFamilyNetIncome,
  getRecentTransactions,
  getTodayPrioritizedAlerts,
  getUrgentCarRegistrationAlerts,
} from '../todayDashboard';

describe('getUrgentCarRegistrationAlerts', () => {
  it('includes expired and <=30-day expirations only', () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const alerts = getUrgentCarRegistrationAlerts([
      { id: '1', year: 2022, make: 'Honda', model: 'Civic', registrationExpiry: '2026-05-01' },
      { id: '2', year: 2023, make: 'Toyota', model: 'RAV4', registrationExpiry: '2026-05-25' },
      { id: '3', year: 2021, make: 'Ford', model: 'Escape', registrationExpiry: '2026-07-15' },
    ], today);

    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.severity)).toEqual(['expired', 'expiringSoon']);
  });
});

describe('getCurrentMonthFamilyNetIncome', () => {
  it('calculates net using only current month transactions', () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const net = getCurrentMonthFamilyNetIncome([
      { id: '1', type: 'income', amount: 2500, date: '2026-05-01' },
      { id: '2', type: 'expense', amount: 800, date: '2026-05-05' },
      { id: '3', type: 'income', amount: 1000, date: '2026-04-30' },
    ], today);

    expect(net).toBe(1700);
  });
});

describe('getRecentTransactions', () => {
  it('returns latest 5 transactions across all properties', () => {
    const recent = getRecentTransactions([
      { id: '1', date: '2026-05-01' },
      { id: '2', date: '2026-05-02' },
      { id: '3', date: '2026-05-03' },
      { id: '4', date: '2026-05-04' },
      { id: '5', date: '2026-05-05' },
      { id: '6', date: '2026-05-06' },
    ]);

    expect(recent.map((t) => t.id)).toEqual(['6', '5', '4', '3', '2']);
  });
});

describe('getClosestVacationCountdown', () => {
  it('returns nearest future vacation with daysUntil', () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const closest = getClosestVacationCountdown([
      { id: 'past', title: 'Old Trip', startDate: '2026-05-01' },
      { id: 'near', title: 'Beach', startDate: '2026-05-12' },
      { id: 'far', title: 'Mountains', startDate: '2026-05-20' },
    ], today);

    expect(closest).toEqual({
      id: 'near',
      title: 'Beach',
      daysUntil: 2,
      startDate: '2026-05-12',
    });
  });
});

describe('countChoresDueToday', () => {
  it('counts chores due today using existing recurrence logic', () => {
    const today = new Date(2026, 4, 11); // Monday
    const due = countChoresDueToday([
      { id: 'daily', recurrence: 'DAILY', isActive: true },
      { id: 'weekly-match', recurrence: 'WEEKLY', daysOfWeek: ['MON'], isActive: true },
      { id: 'weekly-miss', recurrence: 'WEEKLY', daysOfWeek: ['TUE'], isActive: true },
      { id: 'inactive', recurrence: 'DAILY', isActive: false },
    ], today);

    expect(due).toBe(2);
  });
});

describe('countChoresDueInNext24Hours', () => {
  it('counts chores due today or tomorrow in the 24-hour planning window', () => {
    const now = new Date(2026, 4, 11, 12, 0, 0); // Monday noon
    const due = countChoresDueInNext24Hours([
      { id: 'daily', recurrence: 'DAILY', isActive: true },
      { id: 'weekly-today', title: 'Kitchen', recurrence: 'WEEKLY', daysOfWeek: ['MON'], isActive: true },
      { id: 'weekly-tomorrow', title: 'Laundry', recurrence: 'WEEKLY', daysOfWeek: ['TUE'], isActive: true },
      { id: 'weekly-later', title: 'Yard', recurrence: 'WEEKLY', daysOfWeek: ['WED'], isActive: true },
      { id: 'inactive', recurrence: 'DAILY', isActive: false },
    ], now);

    expect(due).toBe(3);
  });
});

describe('getTodayPrioritizedAlerts', () => {
  it('builds a prioritized list using 24h/30d/14d windows', () => {
    const now = new Date(2026, 4, 10, 12, 0, 0); // 2026-05-10
    const alerts = getTodayPrioritizedAlerts(
      [
        { id: 'car-expired', make: 'Honda', model: 'Civic', registrationExpiry: '2026-05-01' },
        { id: 'car-warning', make: 'Toyota', model: 'RAV4', registrationExpiry: '2026-05-25' },
        { id: 'car-outside', make: 'Ford', model: 'Escape', registrationExpiry: '2026-06-09' }, // +30d (excluded)
      ],
      [
        { id: 'vac-near', title: 'Beach Trip', startDate: '2026-05-20' },
        { id: 'vac-outside', title: 'Far Trip', startDate: '2026-05-24' }, // +14d (excluded)
      ],
      [
        { id: 'chore-now', title: 'Wash dishes', recurrence: 'DAILY', isActive: true },
        { id: 'chore-later', title: 'Yard', recurrence: 'WEEKLY', daysOfWeek: ['WED'], isActive: true },
      ],
      now
    );

    expect(alerts.map((a) => a.id)).toEqual([
      'car-car-expired',
      'chore-chore-now',
      'car-car-warning',
      'vacation-vac-near',
    ]);
    expect(alerts.map((a) => a.severity)).toEqual(['critical', 'warning', 'warning', 'info']);
  });

  it('returns an empty list when nothing qualifies for today', () => {
    const now = new Date(2026, 4, 10, 12, 0, 0);
    const alerts = getTodayPrioritizedAlerts(
      [{ id: 'car-ok', registrationExpiry: '2026-07-01' }],
      [{ id: 'vac-later', startDate: '2026-06-20' }],
      [{ id: 'chore-inactive', recurrence: 'DAILY', isActive: false }],
      now
    );

    expect(alerts).toEqual([]);
  });
});
