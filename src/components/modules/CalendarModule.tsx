import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { FamilyRole } from '../../utils/familyContext';
import { canEditContent, canDeleteContent } from '../../utils/rolePermissions';
import type { ActiveModule } from '../../utils/dashboardModules';
import { assertAmplifyResult } from '../../utils/errorReporter';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from '../../utils/calendarConstants';

export { EVENT_COLORS, EVENT_TYPE_LABELS };

const client = generateClient<Schema>();

// Module that "owns" each linked event type so we can navigate to it.
const EVENT_SOURCE_MODULE: Record<string, ActiveModule> = {
  vacation: 'vacations',
  chore: 'chores',
  car: 'cars',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CalendarModuleProps {
  familyId: string;
  role: FamilyRole;
  canPlan: boolean;
  onNavigateTo: (module: ActiveModule) => void;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface EventFormState {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  notes: string;
  timezone: string;
}

function defaultForm(dateStr?: string): EventFormState {
  return {
    title: '',
    startDate: dateStr ?? new Date().toISOString().slice(0, 10),
    endDate: '',
    allDay: true,
    notes: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarModule({
  familyId,
  role,
  canPlan,
  onNavigateTo,
}: CalendarModuleProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [form, setForm] = useState<EventFormState>(defaultForm());
  const [pendingDelete, setPendingDelete] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = canEditContent({ role, canPlan });
  const canDelete = canDeleteContent({ role, canPlan });

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data } = await client.models.CalendarEvent.list({
        filter: {
          familyId: { eq: familyId },
          isDeleted: { ne: true },
        },
      });
      setEvents(data ?? []);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setFetchError('Unable to load calendar events right now. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // -------------------------------------------------------------------------
  // FullCalendar event adapter
  // -------------------------------------------------------------------------

  const toFCEvent = (ev: any) => {
    const type: string = ev.type ?? 'manual';
    return {
      id: ev.id,
      title: ev.title,
      start: ev.startDate,
      end: ev.endDate ?? undefined,
      allDay: ev.allDay ?? true,
      backgroundColor: EVENT_COLORS[type] ?? EVENT_COLORS.manual,
      borderColor: EVENT_COLORS[type] ?? EVENT_COLORS.manual,
      extendedProps: { raw: ev },
    };
  };

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event.extendedProps.raw);
  };

  const handleDateClick = (arg: any) => {
    if (!canEdit) return;
    setForm(defaultForm(arg.dateStr));
    setEditingEvent(null);
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setForm(defaultForm());
    setEditingEvent(null);
    setShowAddModal(true);
  };

  const openEditModal = (ev: any) => {
    setForm({
      title: ev.title ?? '',
      startDate: ev.startDate ? ev.startDate.slice(0, 10) : '',
      endDate: ev.endDate ? ev.endDate.slice(0, 10) : '',
      allDay: ev.allDay ?? true,
      notes: ev.notes ?? '',
      timezone: ev.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setEditingEvent(ev);
    setSelectedEvent(null);
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate) return;
    setSaving(true);
    try {
      const payload = {
        familyId,
        title: form.title.trim(),
        // Use explicit UTC midnight to preserve the date-picker value regardless
        // of the user's local timezone offset.
        startDate: `${form.startDate}T00:00:00.000Z`,
        endDate: form.endDate ? `${form.endDate}T00:00:00.000Z` : undefined,
        allDay: form.allDay,
        notes: form.notes.trim() || undefined,
        timezone: form.timezone,
        type: 'manual' as const,
      };
      if (editingEvent) {
        const updateResult = await client.models.CalendarEvent.update({ id: editingEvent.id, ...payload });
        assertAmplifyResult(updateResult, 'Failed to update event.');
        setToast({ message: 'Event updated!', type: 'success' });
      } else {
        const createResult = await client.models.CalendarEvent.create(payload);
        assertAmplifyResult(createResult, 'Failed to add event.');
        setToast({ message: 'Event added!', type: 'success' });
      }
      setShowAddModal(false);
      await fetchEvents();
    } catch (err) {
      console.error('Error saving calendar event:', err);
      setToast({ message: 'Failed to save event.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (ev: any) => {
    setPendingDelete({
      message: `Delete "${ev.title}"? This cannot be undone.`,
      onConfirm: async () => {
        setPendingDelete(null);
        try {
          await client.models.CalendarEvent.delete({ id: ev.id });
          setSelectedEvent(null);
          setToast({ message: 'Event deleted.', type: 'success' });
          await fetchEvents();
        } catch (err) {
          console.error('Error deleting calendar event:', err);
          setToast({ message: 'Failed to delete event.', type: 'error' });
        }
      },
    });
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const fcEvents = events.map(toFCEvent);
  const isEmpty = !loading && !fetchError && events.length === 0;

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-3xl font-bold text-gray-800">Family Calendar</h2>
        {canEdit && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-4 py-2 rounded-lg transition font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Event
          </button>
        )}
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: EVENT_COLORS[type] }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-lg shadow-md p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400">Loading events…</p>
          </div>
        ) : (
          <>
            {fetchError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {fetchError}
              </div>
            )}
            {/* Empty state notice rendered above the calendar grid */}
            {isEmpty && (
              <div className="mb-4 flex flex-col items-center text-center py-6 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <svg
                  className="w-12 h-12 text-gray-300 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-500 max-w-md text-sm">
                  Calendar events will appear here automatically as you add vacations, chores, car
                  reminders, and family plans.
                </p>
              </div>
            )}
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              weekends={true}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek',
              }}
              height="auto"
              events={fcEvents}
              eventClick={handleEventClick}
              dateClick={canEdit ? handleDateClick : undefined}
            />
          </>
        )}
      </div>

      {/* ── Event Detail Modal ─────────────────────────────────────────────── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEvent(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <span
                  className="inline-block text-xs font-semibold px-2 py-1 rounded-full text-white mb-2"
                  style={{
                    backgroundColor: EVENT_COLORS[selectedEvent.type ?? 'manual'],
                  }}
                >
                  {EVENT_TYPE_LABELS[selectedEvent.type ?? 'manual']}
                </span>
                <h3
                  id="event-detail-title"
                  className="text-xl font-bold text-gray-800 break-words"
                >
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4 shrink-0"
                aria-label="Close event details"
              >
                &times;
              </button>
            </div>

            {/* Details */}
            <div className="space-y-2 mb-4 text-sm text-gray-600">
              <p>
                <span className="font-medium">Start:</span> {formatDate(selectedEvent.startDate)}
              </p>
              {selectedEvent.endDate && (
                <p>
                  <span className="font-medium">End:</span> {formatDate(selectedEvent.endDate)}
                </p>
              )}
              {selectedEvent.timezone && (
                <p>
                  <span className="font-medium">Timezone:</span> {selectedEvent.timezone}
                </p>
              )}
              {selectedEvent.notes && (
                <p>
                  <span className="font-medium">Notes:</span> {selectedEvent.notes}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
              {/* View in module CTA for linked events */}
              {selectedEvent.type !== 'manual' &&
                EVENT_SOURCE_MODULE[selectedEvent.type] && (
                  <button
                    onClick={() => {
                      onNavigateTo(EVENT_SOURCE_MODULE[selectedEvent.type]);
                      setSelectedEvent(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-royal-blue-50 hover:bg-royal-blue-100 text-royal-blue-700 rounded-lg text-sm font-medium transition border border-royal-blue-200"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    View in{' '}
                    {EVENT_TYPE_LABELS[selectedEvent.type]?.replace(/^.*?\s/, '')}
                  </button>
                )}

              {/* Edit for manual events */}
              {selectedEvent.type === 'manual' && canEdit && (
                <button
                  onClick={() => openEditModal(selectedEvent)}
                  className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Edit
                </button>
              )}

              {/* Delete for manual events */}
              {selectedEvent.type === 'manual' && canDelete && (
                <button
                  onClick={() => handleDelete(selectedEvent)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Delete
                </button>
              )}

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Event Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-form-title"
        >
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 id="event-form-title" className="text-xl font-bold text-gray-800 mb-4">
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="Event title"
                  required
                  autoFocus
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* All-day status */}
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cal-allDay"
                    checked={true}
                    disabled
                    aria-disabled="true"
                    className="w-4 h-4 text-royal-blue-600 border-gray-300 rounded cursor-not-allowed"
                  />
                  <label htmlFor="cal-allDay" className="text-sm font-medium text-gray-700">
                    All day
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  This form currently supports date-only events. Time-specific events are not yet supported.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="Optional notes"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-royal-blue-600 hover:bg-royal-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ─────────────────────────────────────────────────── */}
      {pendingDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete Event"
          message={pendingDelete.message}
          onConfirm={pendingDelete.onConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
