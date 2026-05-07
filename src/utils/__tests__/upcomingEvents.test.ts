import { describe, it, expect } from 'vitest';
import { getRelativeDayLabel, getUpcomingEvents } from '../upcomingEvents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a local-midnight Date from an ISO date string. */
function ld(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Build a CalendarEvent-like stub with required fields. */
function makeEvent(
  id: string,
  title: string,
  startDate: string,
  type = 'manual',
  isDeleted = false,
) {
  return { id, title, startDate: `${startDate}T00:00:00.000Z`, type, isDeleted };
}

// Reference "today": Wednesday 2024-03-20
const TODAY = ld('2024-03-20');

// ---------------------------------------------------------------------------
// getRelativeDayLabel
// ---------------------------------------------------------------------------

describe('getRelativeDayLabel', () => {
  it('returns "Today" for the same calendar day', () => {
    expect(getRelativeDayLabel(ld('2024-03-20'), TODAY)).toBe('Today');
  });

  it('returns "Tomorrow" for the next calendar day', () => {
    expect(getRelativeDayLabel(ld('2024-03-21'), TODAY)).toBe('Tomorrow');
  });

  it('returns the full day name for 2 days out', () => {
    expect(getRelativeDayLabel(ld('2024-03-22'), TODAY)).toBe('Friday');
  });

  it('returns the full day name for 6 days out', () => {
    expect(getRelativeDayLabel(ld('2024-03-26'), TODAY)).toBe('Tuesday');
  });

  it('returns an ISO date string for 7 days out', () => {
    expect(getRelativeDayLabel(ld('2024-03-27'), TODAY)).toBe('2024-03-27');
  });

  it('returns an ISO date string for events further than a week away', () => {
    expect(getRelativeDayLabel(ld('2024-04-10'), TODAY)).toBe('2024-04-10');
  });

  it('uses UTC calendar getters for date comparisons/formatting', () => {
    const originalGetFullYear = Date.prototype.getFullYear;
    const originalGetMonth = Date.prototype.getMonth;
    const originalGetDate = Date.prototype.getDate;

    Date.prototype.getFullYear = () => {
      throw new Error('local getFullYear should not be used');
    };
    Date.prototype.getMonth = () => {
      throw new Error('local getMonth should not be used');
    };
    Date.prototype.getDate = () => {
      throw new Error('local getDate should not be used');
    };

    try {
      expect(getRelativeDayLabel(new Date('2024-03-27T00:00:00.000Z'), TODAY)).toBe('2024-03-27');
    } finally {
      Date.prototype.getFullYear = originalGetFullYear;
      Date.prototype.getMonth = originalGetMonth;
      Date.prototype.getDate = originalGetDate;
    }
  });
});

// ---------------------------------------------------------------------------
// getUpcomingEvents
// ---------------------------------------------------------------------------

describe('getUpcomingEvents', () => {
  it('returns at most maxCount events', () => {
    const events = [
      makeEvent('1', 'A', '2024-03-20'),
      makeEvent('2', 'B', '2024-03-21'),
      makeEvent('3', 'C', '2024-03-22'),
      makeEvent('4', 'D', '2024-03-23'),
      makeEvent('5', 'E', '2024-03-24'),
      makeEvent('6', 'F', '2024-03-25'),
    ];
    expect(getUpcomingEvents(events, TODAY, 5)).toHaveLength(5);
    expect(getUpcomingEvents(events, TODAY, 3)).toHaveLength(3);
  });

  it('excludes past events', () => {
    const events = [
      makeEvent('1', 'Past', '2024-03-19'),
      makeEvent('2', 'Today', '2024-03-20'),
      makeEvent('3', 'Future', '2024-03-21'),
    ];
    const result = getUpcomingEvents(events, TODAY);
    expect(result.map((e) => e.id)).toEqual(['2', '3']);
  });

  it('excludes events beyond the 7-day window', () => {
    const events = [
      makeEvent('1', 'Within', '2024-03-26'), // 6 days out — included
      makeEvent('2', 'Outside', '2024-03-27'), // 7 days out — excluded (< windowEnd)
    ];
    const result = getUpcomingEvents(events, TODAY);
    expect(result.map((e) => e.id)).toEqual(['1']);
  });

  it('excludes soft-deleted events', () => {
    const events = [
      makeEvent('1', 'Deleted', '2024-03-20', 'manual', true),
      makeEvent('2', 'Active', '2024-03-20'),
    ];
    const result = getUpcomingEvents(events, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('sorts events by startDate ascending', () => {
    const events = [
      makeEvent('3', 'C', '2024-03-22'),
      makeEvent('1', 'A', '2024-03-20'),
      makeEvent('2', 'B', '2024-03-21'),
    ];
    const ids = getUpcomingEvents(events, TODAY).map((e) => e.id);
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('attaches the correct dayLabel to each item', () => {
    const events = [
      makeEvent('1', 'A', '2024-03-20'),
      makeEvent('2', 'B', '2024-03-21'),
      makeEvent('3', 'C', '2024-03-22'),
    ];
    const result = getUpcomingEvents(events, TODAY);
    expect(result[0].dayLabel).toBe('Today');
    expect(result[1].dayLabel).toBe('Tomorrow');
    expect(result[2].dayLabel).toBe('Friday');
  });

  it('returns an empty array when there are no upcoming events', () => {
    const events = [
      makeEvent('1', 'Past', '2024-03-18'),
      makeEvent('2', 'Past2', '2024-03-19'),
    ];
    expect(getUpcomingEvents(events, TODAY)).toHaveLength(0);
  });

  it('returns an empty array for an empty input list', () => {
    expect(getUpcomingEvents([], TODAY)).toHaveLength(0);
  });

  it('defaults maxCount to 5', () => {
    // 7 events all within the 7-day window; only 5 should be returned
    const events = Array.from({ length: 7 }, (_, i) =>
      makeEvent(`${i}`, `Event ${i}`, `2024-03-${String(20 + i).padStart(2, '0')}`),
    );
    expect(getUpcomingEvents(events, TODAY)).toHaveLength(5);
  });

  it('uses the event type from the raw record', () => {
    const events = [makeEvent('1', 'Trip', '2024-03-20', 'vacation')];
    expect(getUpcomingEvents(events, TODAY)[0].type).toBe('vacation');
  });

  it('falls back to "manual" when type is null', () => {
    const ev = { id: '1', title: 'No type', startDate: '2024-03-20T00:00:00.000Z', type: null };
    expect(getUpcomingEvents([ev], TODAY)[0].type).toBe('manual');
  });

  it('includes the YYYY-MM-DD dateStr on each item', () => {
    const events = [makeEvent('1', 'A', '2024-03-20')];
    expect(getUpcomingEvents(events, TODAY)[0].dateStr).toBe('2024-03-20');
  });

  it('uses UTC calendar getters when filtering and formatting upcoming events', () => {
    const originalGetFullYear = Date.prototype.getFullYear;
    const originalGetMonth = Date.prototype.getMonth;
    const originalGetDate = Date.prototype.getDate;

    Date.prototype.getFullYear = () => {
      throw new Error('local getFullYear should not be used');
    };
    Date.prototype.getMonth = () => {
      throw new Error('local getMonth should not be used');
    };
    Date.prototype.getDate = () => {
      throw new Error('local getDate should not be used');
    };

    try {
      const result = getUpcomingEvents([makeEvent('1', 'UTC Midnight', '2024-03-20')], TODAY);
      expect(result[0].dayLabel).toBe('Today');
      expect(result[0].dateStr).toBe('2024-03-20');
    } finally {
      Date.prototype.getFullYear = originalGetFullYear;
      Date.prototype.getMonth = originalGetMonth;
      Date.prototype.getDate = originalGetDate;
    }
  });
});
