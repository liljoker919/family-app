import { describe, expect, it } from 'vitest';
import {
  countChoresDueToday,
  getClosestVacationCountdown,
  getCurrentMonthFamilyNetIncome,
  getRecentTransactions,
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
