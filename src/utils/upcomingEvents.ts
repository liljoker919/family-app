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

function getUpcomingWindowBounds(today: Date, maxDays: number): { todayStart: Date; windowEnd: Date } {
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const windowEnd = new Date(todayStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + maxDays);
  return { todayStart, windowEnd };
}

export function getUpcomingWindowIsoRange(today: Date = new Date(), maxDays = 7): { startIso: string; endIso: string } {
  const { todayStart, windowEnd } = getUpcomingWindowBounds(today, maxDays);
  return { startIso: todayStart.toISOString(), endIso: windowEnd.toISOString() };
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
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffMs = eventStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays >= 2 && diffDays <= 6) {
    return eventStart.toLocaleDateString('en-US', { weekday: 'long' });
  }
  // Fallback: YYYY-MM-DD
  const y = eventStart.getFullYear();
  const m = String(eventStart.getMonth() + 1).padStart(2, '0');
  const d = String(eventStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
      const evStart = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
      return evStart >= todayStart && evStart < windowEnd;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, maxCount)
    .map((ev) => {
      const evDate = new Date(ev.startDate);
      const y = evDate.getFullYear();
      const m = String(evDate.getMonth() + 1).padStart(2, '0');
      const d = String(evDate.getDate()).padStart(2, '0');
      return {
        id: ev.id,
        title: ev.title,
        dayLabel: getRelativeDayLabel(evDate, today),
        dateStr: `${y}-${m}-${d}`,
        type: ev.type ?? 'manual',
      };
    });
}
