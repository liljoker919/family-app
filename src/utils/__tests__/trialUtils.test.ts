import { describe, it, expect } from 'vitest';
import {
  TRIAL_DURATION_DAYS,
  computeTrialEndsAt,
  computeTrialDaysLeft,
  getTrialInfo,
} from '../trialUtils';

// ---------------------------------------------------------------------------
// computeTrialEndsAt
// ---------------------------------------------------------------------------

describe('computeTrialEndsAt', () => {
  it('returns a date exactly TRIAL_DURATION_DAYS after the start date', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const endsAt = computeTrialEndsAt(start);
    const expected = new Date('2026-01-01T00:00:00.000Z');
    expected.setDate(expected.getDate() + TRIAL_DURATION_DAYS);
    expect(endsAt.getTime()).toBe(expected.getTime());
  });

  it('handles start dates near month boundaries', () => {
    const start = '2026-01-28T12:00:00.000Z';
    const endsAt = computeTrialEndsAt(start);
    // 10 days after Jan 28 = Feb 7
    expect(endsAt.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(endsAt.getUTCDate()).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// computeTrialDaysLeft
// ---------------------------------------------------------------------------

describe('computeTrialDaysLeft', () => {
  it('returns TRIAL_DURATION_DAYS on the start date', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(computeTrialDaysLeft(start, now)).toBe(TRIAL_DURATION_DAYS);
  });

  it('returns a decreasing value as days pass', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const fiveDaysLater = new Date('2026-01-06T00:00:00.000Z');
    expect(computeTrialDaysLeft(start, fiveDaysLater)).toBe(5);
  });

  it('returns 1 on the last day of the trial', () => {
    const start = '2026-01-01T00:00:00.000Z';
    // 9 days later = 1 day remaining (ceiling logic)
    const nineDaysLater = new Date('2026-01-10T00:00:00.000Z');
    expect(computeTrialDaysLeft(start, nineDaysLater)).toBe(1);
  });

  it('returns 0 when the trial has expired', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const elevenDaysLater = new Date('2026-01-12T00:00:00.000Z');
    expect(computeTrialDaysLeft(start, elevenDaysLater)).toBe(0);
  });

  it('never returns a negative number', () => {
    const start = '2020-01-01T00:00:00.000Z';
    const farFuture = new Date('2099-01-01T00:00:00.000Z');
    expect(computeTrialDaysLeft(start, farFuture)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTrialInfo
// ---------------------------------------------------------------------------

describe('getTrialInfo', () => {
  it('returns isActive=false when trialStatus is null', () => {
    const info = getTrialInfo('2026-01-01T00:00:00.000Z', null);
    expect(info.isActive).toBe(false);
    expect(info.daysLeft).toBe(0);
    expect(info.endsAt).toBeNull();
  });

  it('returns isActive=false when trialStartDate is null', () => {
    const info = getTrialInfo(null, 'TRIAL');
    expect(info.isActive).toBe(false);
    expect(info.daysLeft).toBe(0);
    expect(info.endsAt).toBeNull();
  });

  it('returns isActive=false when trialStatus is ACTIVE', () => {
    const info = getTrialInfo('2026-01-01T00:00:00.000Z', 'ACTIVE');
    expect(info.isActive).toBe(false);
  });

  it('returns isActive=false when trialStatus is EXPIRED', () => {
    const info = getTrialInfo('2026-01-01T00:00:00.000Z', 'EXPIRED');
    expect(info.isActive).toBe(false);
  });

  it('returns correct info for an ongoing TRIAL on day 1', () => {
    const start = '2026-06-01T00:00:00.000Z';
    const now = new Date('2026-06-01T00:00:00.000Z');
    const info = getTrialInfo(start, 'TRIAL', now);
    expect(info.isActive).toBe(true);
    expect(info.daysLeft).toBe(TRIAL_DURATION_DAYS);
    expect(info.endsAt).not.toBeNull();
  });

  it('returns correct days left mid-trial', () => {
    const start = '2026-06-01T00:00:00.000Z';
    const now = new Date('2026-06-04T00:00:00.000Z'); // 3 days in
    const info = getTrialInfo(start, 'TRIAL', now);
    expect(info.isActive).toBe(true);
    expect(info.daysLeft).toBe(7);
  });

  it('returns isActive=false and daysLeft=0 when TRIAL has expired', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const now = new Date('2026-01-15T00:00:00.000Z'); // 14 days later
    const info = getTrialInfo(start, 'TRIAL', now);
    expect(info.isActive).toBe(false);
    expect(info.daysLeft).toBe(0);
  });
});
