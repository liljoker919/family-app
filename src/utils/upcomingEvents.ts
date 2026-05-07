/**
 * upcomingEvents.ts
 *
 * Utilities for deriving the "Upcoming this week" widget data from a list of
 * CalendarEvent records.
 */

export interface UpcomingEventItem {
  id: string;
  title: string;
  /** Human-friendly relative label: "Today", "Tomorrow", or a full day name
   *  (e.g. "Wednesday").  Events further than 6 days out use the full date. */
  dayLabel: string;
  /** ISO date string (YYYY-MM-DD) for the event start date. */
  dateStr: string;
  /** The event type string from the CalendarEvent model. */
  type: string;
}

function getUtcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getUpcomingWindowBounds(today: Date, maxDays: number): { todayStart: number; windowEnd: number } {
  const todayStart = getUtcDayStart(today);
  const windowEndDate = new Date(todayStart);
  windowEndDate.setUTCDate(windowEndDate.getUTCDate() + maxDays);
  return { todayStart, windowEnd: windowEndDate.getTime() };
}

export function getUpcomingWindowIsoRange(today: Date = new Date(), maxDays = 7): { startIso: string; endIso: string } {
  const { todayStart, windowEnd } = getUpcomingWindowBounds(today, maxDays);
  return { startIso: new Date(todayStart).toISOString(), endIso: new Date(windowEnd).toISOString() };
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a human-friendly relative label for `eventDate` relative to `today`.
 *
 * - Same calendar day  → "Today"
 * - Next calendar day  → "Tomorrow"
 * - 2–6 days ahead     → full day name (e.g. "Wednesday")
 * - Further out        → short ISO date (YYYY-MM-DD)
 */
export function getRelativeDayLabel(eventDate: Date, today: Date): string {
  const todayStart = getUtcDayStart(today);
  const eventStart = getUtcDayStart(eventDate);
  const diffMs = eventStart - todayStart;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays >= 2 && diffDays <= 6) {
    return eventDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  }
  return formatUtcDate(eventDate);
}

/**
 * Given a raw list of CalendarEvent records (as returned from Amplify), returns
 * up to `maxCount` upcoming events starting from `today` and within the next
 * `maxDays` days, sorted by start date ascending, with relative day labels
 * attached.
 *
 * Events with no `startDate`, outside the window, or soft-deleted
 * (`isDeleted === true`) are excluded.
 */
export function getUpcomingEvents(
  events: Array<{ id: string; title: string; startDate: string; type?: string | null; isDeleted?: boolean | null }>,
  today: Date = new Date(),
  maxCount = 5,
  maxDays = 7,
): UpcomingEventItem[] {
  const { todayStart, windowEnd } = getUpcomingWindowBounds(today, maxDays);

  return events
    .filter((ev) => {
      if (!ev.startDate) return false;
      if (ev.isDeleted) return false;
      const evDate = new Date(ev.startDate);
      const evStart = getUtcDayStart(evDate);
      return evStart >= todayStart && evStart < windowEnd;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, maxCount)
    .map((ev) => {
      const evDate = new Date(ev.startDate);
      return {
        id: ev.id,
        title: ev.title,
        dayLabel: getRelativeDayLabel(evDate, today),
        dateStr: formatUtcDate(evDate),
        type: ev.type ?? 'manual',
      };
    });
}
