/**
 * Shared display constants for calendar event types.
 *
 * Kept in a separate module so lightweight consumers (e.g. UpcomingWidget)
 * can import these values without pulling in the @fullcalendar library that
 * is only needed by CalendarModule.
 */

export const EVENT_COLORS: Record<string, string> = {
  vacation: '#0046a7',
  chore: '#d97706',
  car: '#059669',
  manual: '#7c3aed',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  vacation: '✈️ Vacation',
  chore: '🧹 Chore',
  car: '🚗 Car Reminder',
  manual: '📌 Family Event',
};
