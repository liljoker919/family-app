/**
 * Notification Preferences – shared types and pure-function helpers.
 *
 * These helpers are used by ProfileModule to compute effective notification
 * states, making the logic independently testable without React.
 */

export interface NotificationPrefs {
  notifyNewChore: boolean;
  notifyCarAlert: boolean;
  notifyVacationReminder: boolean;
  notifyMarketingUpdates: boolean;
  notifyByEmail: boolean;
  notifyByPush: boolean;
  globalUnsubscribe: boolean;
}

/**
 * Default notification preferences used when a Profile record has no stored
 * value for a field (backwards-compatible: existing users are treated as
 * fully opted-in to functional notifications and opted-out of marketing).
 */
export const DEFAULT_PREFS: NotificationPrefs = {
  notifyNewChore: true,
  notifyCarAlert: true,
  notifyVacationReminder: true,
  notifyMarketingUpdates: false,
  notifyByEmail: true,
  notifyByPush: false,
  globalUnsubscribe: false,
};

/**
 * Merge a partial Profile record's notification fields with the defaults.
 * Any field that is `null` or `undefined` falls back to the default value.
 */
export function mergeWithDefaults(
  stored: Partial<Record<keyof NotificationPrefs, boolean | null | undefined>>
): NotificationPrefs {
  return {
    notifyNewChore: stored.notifyNewChore ?? DEFAULT_PREFS.notifyNewChore,
    notifyCarAlert: stored.notifyCarAlert ?? DEFAULT_PREFS.notifyCarAlert,
    notifyVacationReminder: stored.notifyVacationReminder ?? DEFAULT_PREFS.notifyVacationReminder,
    notifyMarketingUpdates: stored.notifyMarketingUpdates ?? DEFAULT_PREFS.notifyMarketingUpdates,
    notifyByEmail: stored.notifyByEmail ?? DEFAULT_PREFS.notifyByEmail,
    notifyByPush: stored.notifyByPush ?? DEFAULT_PREFS.notifyByPush,
    globalUnsubscribe: stored.globalUnsubscribe ?? DEFAULT_PREFS.globalUnsubscribe,
  };
}

/**
 * Returns the effective "on" state for a single notification toggle, taking
 * the global unsubscribe flag into account.  When globalUnsubscribe is true
 * every individual toggle is effectively off.
 */
export function isNotifEnabled(
  prefs: NotificationPrefs,
  key: Exclude<keyof NotificationPrefs, 'globalUnsubscribe'>
): boolean {
  if (prefs.globalUnsubscribe) return false;
  return prefs[key];
}

/**
 * Returns true when at least one non-marketing, non-delivery notification is
 * active (used by Lambda functions to decide whether to send an alert email).
 */
export function hasAnyFunctionalNotifEnabled(prefs: NotificationPrefs): boolean {
  return (
    isNotifEnabled(prefs, 'notifyNewChore') ||
    isNotifEnabled(prefs, 'notifyCarAlert') ||
    isNotifEnabled(prefs, 'notifyVacationReminder')
  );
}
