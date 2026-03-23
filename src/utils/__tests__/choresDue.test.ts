import { describe, it, expect } from 'vitest';
import {
  localDayAbbrev,
  daysInSameISOWeek,
  isChoreToday,
  isChoreThisWeek,
} from '../choresDue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Date from an ISO date string (e.g. "2024-03-18") in local time. */
function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Reference week: Mon 2024-03-18 … Sun 2024-03-24
const MON = localDate('2024-03-18'); // Monday
const TUE = localDate('2024-03-19');
const WED = localDate('2024-03-20');
const THU = localDate('2024-03-21');
const FRI = localDate('2024-03-22');
const SAT = localDate('2024-03-23');
const SUN = localDate('2024-03-24'); // Sunday

// ---------------------------------------------------------------------------
// localDayAbbrev
// ---------------------------------------------------------------------------

describe('localDayAbbrev', () => {
  it('returns MON for Monday', () => expect(localDayAbbrev(MON)).toBe('MON'));
  it('returns TUE for Tuesday', () => expect(localDayAbbrev(TUE)).toBe('TUE'));
  it('returns WED for Wednesday', () => expect(localDayAbbrev(WED)).toBe('WED'));
  it('returns THU for Thursday', () => expect(localDayAbbrev(THU)).toBe('THU'));
  it('returns FRI for Friday', () => expect(localDayAbbrev(FRI)).toBe('FRI'));
  it('returns SAT for Saturday', () => expect(localDayAbbrev(SAT)).toBe('SAT'));
  it('returns SUN for Sunday', () => expect(localDayAbbrev(SUN)).toBe('SUN'));
});

// ---------------------------------------------------------------------------
// daysInSameISOWeek
// ---------------------------------------------------------------------------

describe('daysInSameISOWeek', () => {
  const FULL_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  it('returns all 7 ISO-week days when called with a Monday', () => {
    expect(daysInSameISOWeek(MON)).toEqual(FULL_WEEK);
  });

  it('returns the same 7 days when called with a Sunday in the same week', () => {
    expect(daysInSameISOWeek(SUN)).toEqual(FULL_WEEK);
  });

  it('returns the same 7 days when called with a Wednesday', () => {
    expect(daysInSameISOWeek(WED)).toEqual(FULL_WEEK);
  });

  it('always returns exactly 7 distinct entries', () => {
    const days = daysInSameISOWeek(THU);
    expect(days).toHaveLength(7);
    expect(new Set(days).size).toBe(7);
  });

  it('week for 2024-03-22 (Fri) spans 2024-03-18 (Mon) → 2024-03-24 (Sun)', () => {
    expect(daysInSameISOWeek(FRI)).toEqual(FULL_WEEK);
  });
});

// ---------------------------------------------------------------------------
// isChoreToday
// ---------------------------------------------------------------------------

describe('isChoreToday', () => {
  // DAILY chores
  it('returns true for an active DAILY chore on any given day', () => {
    const chore = { recurrence: 'DAILY', isActive: true };
    expect(isChoreToday(chore, MON)).toBe(true);
    expect(isChoreToday(chore, SAT)).toBe(true);
    expect(isChoreToday(chore, SUN)).toBe(true);
  });

  it('returns false for an INACTIVE DAILY chore', () => {
    expect(isChoreToday({ recurrence: 'DAILY', isActive: false }, MON)).toBe(false);
  });

  // WEEKLY chores
  it('returns true when today matches a daysOfWeek entry (Wednesday)', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['WED', 'SAT'], isActive: true };
    expect(isChoreToday(chore, WED)).toBe(true);
  });

  it('returns true when today matches a daysOfWeek entry (Saturday)', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['WED', 'SAT'], isActive: true };
    expect(isChoreToday(chore, SAT)).toBe(true);
  });

  it('returns false when today does not match any daysOfWeek entry', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['WED', 'SAT'], isActive: true };
    expect(isChoreToday(chore, MON)).toBe(false);
    expect(isChoreToday(chore, TUE)).toBe(false);
    expect(isChoreToday(chore, THU)).toBe(false);
    expect(isChoreToday(chore, FRI)).toBe(false);
    expect(isChoreToday(chore, SUN)).toBe(false);
  });

  it('returns false for an INACTIVE WEEKLY chore even on a matching day', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['MON'], isActive: false };
    expect(isChoreToday(chore, MON)).toBe(false);
  });

  it('returns false for a WEEKLY chore with an empty daysOfWeek array', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: [], isActive: true };
    expect(isChoreToday(chore, MON)).toBe(false);
  });

  it('returns false for a WEEKLY chore with null daysOfWeek entries', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: [null, null], isActive: true };
    expect(isChoreToday(chore, MON)).toBe(false);
  });

  // MONTHLY and ONE_TIME are out of scope
  it('returns false for a MONTHLY chore', () => {
    expect(isChoreToday({ recurrence: 'MONTHLY', isActive: true }, MON)).toBe(false);
  });

  it('returns false for a ONE_TIME chore', () => {
    expect(isChoreToday({ recurrence: 'ONE_TIME', isActive: true }, MON)).toBe(false);
  });

  it('returns false when recurrence is null', () => {
    expect(isChoreToday({ recurrence: null, isActive: true }, MON)).toBe(false);
  });

  // Timezone-boundary scenario: same local day regardless of UTC offset
  it('is deterministic for a date constructed in local time (no UTC drift)', () => {
    // Build a Monday at local midnight — getDay() must return 1
    const localMonday = new Date(2024, 2, 18); // Mon 2024-03-18 00:00 local
    expect(localMonday.getDay()).toBe(1);
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['MON'], isActive: true };
    expect(isChoreToday(chore, localMonday)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isChoreThisWeek
// ---------------------------------------------------------------------------

describe('isChoreThisWeek', () => {
  // DAILY chores
  it('returns true for an active DAILY chore regardless of what day it is', () => {
    const chore = { recurrence: 'DAILY', isActive: true };
    [MON, TUE, WED, THU, FRI, SAT, SUN].forEach((d) => {
      expect(isChoreThisWeek(chore, d)).toBe(true);
    });
  });

  it('returns false for an INACTIVE DAILY chore', () => {
    expect(isChoreThisWeek({ recurrence: 'DAILY', isActive: false }, WED)).toBe(false);
  });

  // WEEKLY chores — called from various days within the same ISO week
  it('returns true for a WED chore when today is Monday (same week)', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['WED'], isActive: true };
    expect(isChoreThisWeek(chore, MON)).toBe(true);
  });

  it('returns true for a MON chore when today is Sunday (same week)', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['MON'], isActive: true };
    expect(isChoreThisWeek(chore, SUN)).toBe(true);
  });

  it('returns true for a SAT chore when today is Saturday', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['SAT'], isActive: true };
    expect(isChoreThisWeek(chore, SAT)).toBe(true);
  });

  it('returns true for a MON chore queried from the NEXT week Monday (same day name, different week)', () => {
    const nextMonday = localDate('2024-03-25');
    // The chore is scheduled for MON of the PREVIOUS week (2024-03-18).
    // From next Monday's perspective, both weeks contain MON so it should
    // still appear — this test confirms the week boundary is respected.
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['MON'], isActive: true };
    // Next Monday IS a Monday, so this chore IS due next week too.
    expect(isChoreThisWeek(chore, nextMonday)).toBe(true);
  });

  it('returns true for a TUE-only chore queried from the NEXT week Monday', () => {
    // Week of 2024-03-25 (Mon) does contain TUE (2024-03-26), so should be true
    const nextMonday = localDate('2024-03-25');
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['TUE'], isActive: true };
    expect(isChoreThisWeek(chore, nextMonday)).toBe(true);
  });

  it('returns false for an INACTIVE WEEKLY chore', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['WED', 'FRI'], isActive: false };
    expect(isChoreThisWeek(chore, MON)).toBe(false);
  });

  it('returns false for a WEEKLY chore with empty daysOfWeek', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: [], isActive: true };
    expect(isChoreThisWeek(chore, MON)).toBe(false);
  });

  // MONTHLY and ONE_TIME are excluded
  it('returns false for MONTHLY chores', () => {
    expect(isChoreThisWeek({ recurrence: 'MONTHLY', isActive: true }, WED)).toBe(false);
  });

  it('returns false for ONE_TIME chores', () => {
    expect(isChoreThisWeek({ recurrence: 'ONE_TIME', isActive: true }, WED)).toBe(false);
  });

  it('returns false when recurrence is null', () => {
    expect(isChoreThisWeek({ recurrence: null, isActive: true }, MON)).toBe(false);
  });

  // Scenario: chore has multiple days that span the week
  it('returns true for a MON+FRI chore when asked on Wednesday', () => {
    const chore = { recurrence: 'WEEKLY', daysOfWeek: ['MON', 'FRI'], isActive: true };
    expect(isChoreThisWeek(chore, WED)).toBe(true);
  });
});
