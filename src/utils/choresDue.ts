/**
 * Recurrence + Due Window Logic
 *
 * Provides deterministic "Today" and "This Week" bucket helpers for chores.
 * All day-of-week arithmetic uses the *local* calendar date so that the
 * boundaries shift at the user's own midnight, not UTC midnight.
 */

export type DayAbbrev = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/** Maps JavaScript's Date.getDay() (0 = Sunday … 6 = Saturday) to our abbreviations. */
const JS_DAY_TO_ABBREV: DayAbbrev[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Returns the local day-of-week abbreviation for the given Date. */
export function localDayAbbrev(date: Date): DayAbbrev {
  return JS_DAY_TO_ABBREV[date.getDay()];
}

/**
 * Returns all seven DayAbbrev values for the ISO week (Mon–Sun) that
 * contains `date`, ordered Monday through Sunday.
 */
export function daysInSameISOWeek(date: Date): DayAbbrev[] {
  // ISO weekday: Monday = 1 … Sunday = 7
  const jsDay = date.getDay(); // 0 (Sun) – 6 (Sat)
  const isoDay = jsDay === 0 ? 7 : jsDay; // 1 – 7

  const result: DayAbbrev[] = [];
  for (let iso = 1; iso <= 7; iso++) {
    const offset = iso - isoDay;
    const d = new Date(date);
    d.setDate(date.getDate() + offset);
    result.push(localDayAbbrev(d));
  }
  return result;
}

export interface ChoreForDueCheck {
  recurrence?: string | null;
  daysOfWeek?: (string | null)[] | null;
  isActive?: boolean | null;
}

/**
 * Returns `true` when a chore is due on the same calendar day as `now`
 * (defaults to the current local date).
 *
 * Rules:
 * - DAILY  → always due today.
 * - WEEKLY → due today if today's local day-of-week appears in `daysOfWeek`.
 * - MONTHLY / ONE_TIME → not included in the "today" bucket.
 * - Inactive chores are never included.
 */
export function isChoreToday(chore: ChoreForDueCheck, now: Date = new Date()): boolean {
  if (chore.isActive === false) return false;
  if (chore.recurrence === 'DAILY') return true;
  if (chore.recurrence === 'WEEKLY') {
    const today = localDayAbbrev(now);
    const days = (chore.daysOfWeek ?? []).filter(Boolean) as string[];
    return days.includes(today);
  }
  return false;
}

/**
 * Returns `true` when a chore is due at least once during the ISO week
 * (Mon–Sun) that contains `now` (defaults to the current local date).
 *
 * Rules:
 * - DAILY  → always due this week.
 * - WEEKLY → due this week if any `daysOfWeek` entry falls within the week.
 * - MONTHLY / ONE_TIME → not included in the "this week" bucket.
 * - Inactive chores are never included.
 */
export function isChoreThisWeek(chore: ChoreForDueCheck, now: Date = new Date()): boolean {
  if (chore.isActive === false) return false;
  if (chore.recurrence === 'DAILY') return true;
  if (chore.recurrence === 'WEEKLY') {
    const weekDays = daysInSameISOWeek(now);
    const days = (chore.daysOfWeek ?? []).filter(Boolean) as string[];
    return days.some((d) => weekDays.includes(d as DayAbbrev));
  }
  return false;
}
