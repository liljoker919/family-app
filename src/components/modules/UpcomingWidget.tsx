import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { getUpcomingEvents, getUpcomingWindowIsoRange } from '../../utils/upcomingEvents';
import type { UpcomingEventItem } from '../../utils/upcomingEvents';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './CalendarModule';
import type { ActiveModule } from '../../utils/dashboardModules';

const client = generateClient<Schema>();

interface UpcomingWidgetProps {
  familyId: string;
  onNavigateTo: (module: ActiveModule) => void;
}

export default function UpcomingWidget({ familyId, onNavigateTo }: UpcomingWidgetProps) {
  const [items, setItems] = useState<UpcomingEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { startIso, endIso } = getUpcomingWindowIsoRange(new Date(), 7);
        const { data } = await client.models.CalendarEvent.list({
          filter: {
            familyId: { eq: familyId },
            isDeleted: { ne: true },
            startDate: { ge: startIso, lt: endIso },
          },
        });
        if (!cancelled) {
          setItems(getUpcomingEvents(data ?? [], new Date(), 5));
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load upcoming events.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId]);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">📅 Upcoming This Week</h2>
        <button
          type="button"
          onClick={() => onNavigateTo('calendar')}
          className="text-sm text-royal-blue-600 hover:underline"
        >
          View Calendar →
        </button>
      </div>

      {loading && (
        <p className="text-gray-400 text-sm">Loading…</p>
      )}

      {!loading && error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-gray-400 text-sm">No events coming up this week.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => {
            const color = EVENT_COLORS[item.type] ?? EVENT_COLORS.manual;
            const typeLabel = EVENT_TYPE_LABELS[item.type] ?? EVENT_TYPE_LABELS.manual;
            return (
              <li key={item.id} className="flex items-start gap-3">
                {/* Color dot */}
                <span
                  className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold">{item.dayLabel}</span>
                    {' · '}
                    {typeLabel}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
