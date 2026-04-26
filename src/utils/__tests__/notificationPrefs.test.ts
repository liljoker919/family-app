/**
 * Unit tests for notificationPrefs utility helpers.
 *
 * Validates the pure-function logic for default merging, effective toggle
 * states, and global unsubscribe behaviour used by ProfileModule.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFS,
  mergeWithDefaults,
  isNotifEnabled,
  hasAnyFunctionalNotifEnabled,
  type NotificationPrefs,
} from '../notificationPrefs';

// ─── DEFAULT_PREFS ────────────────────────────────────────────────────────────

describe('DEFAULT_PREFS', () => {
  it('has functional notifications enabled by default', () => {
    expect(DEFAULT_PREFS.notifyNewChore).toBe(true);
    expect(DEFAULT_PREFS.notifyCarAlert).toBe(true);
    expect(DEFAULT_PREFS.notifyVacationReminder).toBe(true);
  });

  it('has marketing notifications disabled by default', () => {
    expect(DEFAULT_PREFS.notifyMarketingUpdates).toBe(false);
  });

  it('has email channel enabled and push disabled by default', () => {
    expect(DEFAULT_PREFS.notifyByEmail).toBe(true);
    expect(DEFAULT_PREFS.notifyByPush).toBe(false);
  });

  it('has globalUnsubscribe disabled by default', () => {
    expect(DEFAULT_PREFS.globalUnsubscribe).toBe(false);
  });
});

// ─── mergeWithDefaults ────────────────────────────────────────────────────────

describe('mergeWithDefaults', () => {
  it('returns all defaults when given an empty object', () => {
    const result = mergeWithDefaults({});
    expect(result).toEqual(DEFAULT_PREFS);
  });

  it('uses stored value when explicitly set to true', () => {
    const result = mergeWithDefaults({ notifyMarketingUpdates: true });
    expect(result.notifyMarketingUpdates).toBe(true);
  });

  it('uses stored value when explicitly set to false', () => {
    const result = mergeWithDefaults({ notifyNewChore: false });
    expect(result.notifyNewChore).toBe(false);
  });

  it('falls back to default when stored value is null', () => {
    const result = mergeWithDefaults({ notifyCarAlert: null });
    expect(result.notifyCarAlert).toBe(DEFAULT_PREFS.notifyCarAlert);
  });

  it('falls back to default when stored value is undefined', () => {
    const result = mergeWithDefaults({ notifyVacationReminder: undefined });
    expect(result.notifyVacationReminder).toBe(DEFAULT_PREFS.notifyVacationReminder);
  });

  it('merges partial stored prefs correctly', () => {
    const result = mergeWithDefaults({
      notifyNewChore: false,
      globalUnsubscribe: true,
    });
    expect(result.notifyNewChore).toBe(false);
    expect(result.globalUnsubscribe).toBe(true);
    // Unset fields get defaults
    expect(result.notifyCarAlert).toBe(DEFAULT_PREFS.notifyCarAlert);
    expect(result.notifyByEmail).toBe(DEFAULT_PREFS.notifyByEmail);
  });
});

// ─── isNotifEnabled ───────────────────────────────────────────────────────────

describe('isNotifEnabled', () => {
  const basePrefs: NotificationPrefs = { ...DEFAULT_PREFS };

  it('returns true when toggle is on and globalUnsubscribe is false', () => {
    expect(isNotifEnabled(basePrefs, 'notifyNewChore')).toBe(true);
  });

  it('returns false when toggle is off and globalUnsubscribe is false', () => {
    const prefs: NotificationPrefs = { ...basePrefs, notifyNewChore: false };
    expect(isNotifEnabled(prefs, 'notifyNewChore')).toBe(false);
  });

  it('returns false when globalUnsubscribe is true even if individual toggle is on', () => {
    const prefs: NotificationPrefs = { ...basePrefs, globalUnsubscribe: true };
    expect(isNotifEnabled(prefs, 'notifyNewChore')).toBe(false);
    expect(isNotifEnabled(prefs, 'notifyCarAlert')).toBe(false);
    expect(isNotifEnabled(prefs, 'notifyVacationReminder')).toBe(false);
    expect(isNotifEnabled(prefs, 'notifyMarketingUpdates')).toBe(false);
    expect(isNotifEnabled(prefs, 'notifyByEmail')).toBe(false);
    expect(isNotifEnabled(prefs, 'notifyByPush')).toBe(false);
  });

  it('respects delivery channel toggles independently', () => {
    const prefs: NotificationPrefs = { ...basePrefs, notifyByEmail: false, notifyByPush: true };
    expect(isNotifEnabled(prefs, 'notifyByEmail')).toBe(false);
    expect(isNotifEnabled(prefs, 'notifyByPush')).toBe(true);
  });
});

// ─── hasAnyFunctionalNotifEnabled ─────────────────────────────────────────────

describe('hasAnyFunctionalNotifEnabled', () => {
  it('returns true when at least one functional notif is enabled', () => {
    expect(hasAnyFunctionalNotifEnabled({ ...DEFAULT_PREFS })).toBe(true);
  });

  it('returns false when all functional notifs are individually disabled', () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_PREFS,
      notifyNewChore: false,
      notifyCarAlert: false,
      notifyVacationReminder: false,
    };
    expect(hasAnyFunctionalNotifEnabled(prefs)).toBe(false);
  });

  it('returns false when globalUnsubscribe is true', () => {
    const prefs: NotificationPrefs = { ...DEFAULT_PREFS, globalUnsubscribe: true };
    expect(hasAnyFunctionalNotifEnabled(prefs)).toBe(false);
  });

  it('returns true when globalUnsubscribe is false and at least one is enabled', () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_PREFS,
      notifyNewChore: false,
      notifyCarAlert: false,
      notifyVacationReminder: true,
      globalUnsubscribe: false,
    };
    expect(hasAnyFunctionalNotifEnabled(prefs)).toBe(true);
  });

  it('does not count marketing or delivery-channel toggles as functional', () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_PREFS,
      notifyNewChore: false,
      notifyCarAlert: false,
      notifyVacationReminder: false,
      notifyMarketingUpdates: true,
      notifyByEmail: true,
      notifyByPush: true,
    };
    expect(hasAnyFunctionalNotifEnabled(prefs)).toBe(false);
  });
});
