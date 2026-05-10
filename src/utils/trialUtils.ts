/**
 * Trial utility functions for the 10-day free trial engine.
 *
 * Trial lifecycle:
 *   TRIAL   – User is within the 10-day window.
 *   ACTIVE  – User has subscribed / been upgraded beyond the trial.
 *   EXPIRED – Trial ended without conversion.
 *
 * These functions are pure (no side-effects, no network calls) so they are
 * easily unit-tested and reusable across frontend components.
 */

export const TRIAL_DURATION_DAYS = 10;

/**
 * Returns the Date on which a trial that started at `trialStartDate` expires.
 *
 * @param trialStartDate – ISO 8601 datetime string (e.g. from AWSDateTime).
 */
export function computeTrialEndsAt(trialStartDate: string): Date {
  const start = new Date(trialStartDate);
  const endsAt = new Date(start);
  endsAt.setUTCDate(endsAt.getUTCDate() + TRIAL_DURATION_DAYS);
  return endsAt;
}

/**
 * Returns the number of whole days remaining in the trial (0 when expired).
 *
 * Uses ceiling so that a trial expiring later today still shows "1 day left"
 * rather than "0 days left".
 *
 * @param trialStartDate – ISO 8601 datetime string.
 * @param now            – Optional reference point (defaults to Date.now()).
 */
export function computeTrialDaysLeft(trialStartDate: string, now: Date = new Date()): number {
  const endsAt = computeTrialEndsAt(trialStartDate);
  const diffMs = endsAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export interface TrialInfo {
  /** Days remaining in the trial (0 when expired or not in a trial). */
  daysLeft: number;
  /** True when the trial is active and daysLeft > 0. */
  isActive: boolean;
  /** The date/time the trial expires, or null when not in a trial. */
  endsAt: Date | null;
}

/**
 * Derives a `TrialInfo` object from the Profile's trial fields.
 *
 * Returns `{ daysLeft: 0, isActive: false, endsAt: null }` whenever the user
 * is not in a TRIAL status (i.e. ACTIVE, EXPIRED, or no trial recorded).
 *
 * @param trialStartDate – value from Profile.trialStartDate (may be null/undefined).
 * @param trialStatus    – value from Profile.trialStatus    (may be null/undefined).
 * @param now            – Optional reference point for unit-testing time-sensitivity.
 */
export function getTrialInfo(
  trialStartDate: string | null | undefined,
  trialStatus: string | null | undefined,
  now: Date = new Date()
): TrialInfo {
  if (!trialStartDate || trialStatus !== 'TRIAL') {
    return { daysLeft: 0, isActive: false, endsAt: null };
  }

  const endsAt = computeTrialEndsAt(trialStartDate);
  const daysLeft = computeTrialDaysLeft(trialStartDate, now);

  return {
    daysLeft,
    isActive: daysLeft > 0,
    endsAt,
  };
}
