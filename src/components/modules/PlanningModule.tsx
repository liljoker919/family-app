import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../amplify/data/resource';

const client = generateClient<Schema>();

const EDITOR_GROUPS = ['ADMIN', 'PLANNER'] as const;

type TripStatus = 'PROPOSED' | 'PLANNING' | 'BOOKED' | 'CANCELED';

const STATUS_LABELS: Record<TripStatus, string> = {
  PROPOSED: 'Proposed',
  PLANNING: 'Planning',
  BOOKED: 'Booked',
  CANCELED: 'Canceled',
};

const STATUS_BADGE: Record<TripStatus, string> = {
  PROPOSED: 'bg-yellow-100 text-yellow-800',
  PLANNING: 'bg-blue-100 text-blue-800',
  BOOKED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-gray-100 text-gray-600',
};

const NEXT_STATUSES: Partial<Record<TripStatus, TripStatus[]>> = {
  PROPOSED: ['PLANNING', 'CANCELED'],
  PLANNING: ['BOOKED', 'CANCELED'],
};

interface PlanningModuleProps {
  user: any;
}

interface TripForm {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  planningNotes: string;
  status: TripStatus;
}

const emptyForm: TripForm = {
  title: '',
  destination: '',
  startDate: '',
  endDate: '',
  description: '',
  planningNotes: '',
  status: 'PROPOSED',
};

export default function PlanningModule({ user }: PlanningModuleProps) {
  const [tripPlans, setTripPlans] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [filterStatus, setFilterStatus] = useState<TripStatus | 'ALL'>('ALL');
  const [filterDestination, setFilterDestination] = useState('');

  useEffect(() => {
    loadUserGroups();
    fetchTripPlans();
  }, []);

  const loadUserGroups = async () => {
    try {
      const session = await fetchAuthSession();
      const groups =
        (session.tokens?.idToken?.payload?.['cognito:groups'] as string[]) ?? [];
      setUserGroups(groups);
    } catch {
      setUserGroups([]);
    }
  };

  const canEdit = userGroups.some((g) => EDITOR_GROUPS.includes(g as typeof EDITOR_GROUPS[number]));

  const fetchTripPlans = async () => {
    try {
      const { data } = await client.models.TripPlan.list();
      setTripPlans(data);
    } catch (error) {
      console.error('Error fetching trip plans:', error);
    }
  };

  const openCreateForm = () => {
    setEditingTrip(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (trip: any) => {
    setEditingTrip(trip);
    setForm({
      title: trip.title ?? '',
      destination: trip.destination ?? '',
      startDate: trip.startDate ?? '',
      endDate: trip.endDate ?? '',
      description: trip.description ?? '',
      planningNotes: trip.planningNotes ?? '',
      status: (trip.status as TripStatus) ?? 'PROPOSED',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createdBy = user?.signInDetails?.loginId;
      if (!createdBy) {
        console.error('Unable to determine user identity for createdBy field');
        return;
      }

      const payload = {
        title: form.title,
        destination: form.destination,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        description: form.description || undefined,
        planningNotes: form.planningNotes || undefined,
        status: form.status,
        createdBy,
      };

      if (editingTrip) {
        await client.models.TripPlan.update({ id: editingTrip.id, ...payload });
      } else {
        await client.models.TripPlan.create(payload);
      }

      setShowForm(false);
      setEditingTrip(null);
      setForm(emptyForm);
      fetchTripPlans();
    } catch (error) {
      console.error('Error saving trip plan:', error);
    }
  };

  const handleStatusChange = async (trip: any, newStatus: TripStatus) => {
    try {
      const update: { id: string; status: TripStatus; bookedAt?: string } = {
        id: trip.id,
        status: newStatus,
      };
      if (newStatus === 'BOOKED') {
        update.bookedAt = new Date().toISOString();
      }
      await client.models.TripPlan.update(update);
      fetchTripPlans();
    } catch (error) {
      console.error('Error updating trip status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trip plan?')) return;
    try {
      await client.models.TripPlan.delete({ id });
      fetchTripPlans();
    } catch (error) {
      console.error('Error deleting trip plan:', error);
    }
  };

  const filteredTrips = tripPlans.filter((trip) => {
    const statusMatch = filterStatus === 'ALL' || trip.status === filterStatus;
    const destMatch =
      !filterDestination ||
      (trip.destination ?? '')
        .toLowerCase()
        .includes(filterDestination.toLowerCase());
    return statusMatch && destMatch;
  });

  const planningTrips = filteredTrips.filter(
    (t) => t.status === 'PROPOSED' || t.status === 'PLANNING'
  );
  const bookedTrips = filteredTrips.filter((t) => t.status === 'BOOKED');
  const canceledTrips = filteredTrips.filter((t) => t.status === 'CANCELED');

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Trip Planning Dashboard</h2>
        {canEdit && (
          <button
            onClick={openCreateForm}
            className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
          >
            + Propose Trip
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TripStatus | 'ALL')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Statuses</option>
            {(Object.keys(STATUS_LABELS) as TripStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Destination</label>
          <input
            type="text"
            placeholder="Search destination…"
            value={filterDestination}
            onChange={(e) => setFilterDestination(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
          />
        </div>
        {(filterStatus !== 'ALL' || filterDestination) && (
          <button
            onClick={() => {
              setFilterStatus('ALL');
              setFilterDestination('');
            }}
            className="text-sm text-royal-blue-600 hover:underline self-end pb-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-screen overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">
              {editingTrip ? 'Edit Trip Proposal' : 'Propose New Trip'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Paris, France or Florida Keys → Miami → Key West"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-gray-400 text-xs">(tentative)</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date <span className="text-gray-400 text-xs">(tentative)</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as TripStatus })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                >
                  {(Object.keys(STATUS_LABELS) as TripStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Summary
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the trip idea…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Planning Notes
                </label>
                <textarea
                  value={form.planningNotes}
                  onChange={(e) => setForm({ ...form, planningNotes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Notes, reminders, decisions…"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
                >
                  {editingTrip ? 'Save Changes' : 'Create Proposal'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTrip(null);
                    setForm(emptyForm);
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Still Planning Section */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
          🗓️ Still Planning
          <span className="text-sm font-normal text-gray-500">({planningTrips.length})</span>
        </h3>
        {planningTrips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            No trips currently being planned.
            {canEdit && (
              <span>
                {' '}
                <button
                  onClick={openCreateForm}
                  className="text-royal-blue-600 hover:underline"
                >
                  Propose one now!
                </button>
              </span>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {planningTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                canEdit={canEdit}
                onEdit={openEditForm}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </section>

      {/* Booked Trips Section */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
          ✅ Booked Trips
          <span className="text-sm font-normal text-gray-500">({bookedTrips.length})</span>
        </h3>
        {bookedTrips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            No booked trips yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {bookedTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                canEdit={canEdit}
                onEdit={openEditForm}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </section>

      {/* Canceled Trips Section (collapsed by default) */}
      {canceledTrips.length > 0 && (
        <section>
          <h3 className="text-xl font-semibold text-gray-400 mb-4 flex items-center gap-2">
            🚫 Canceled
            <span className="text-sm font-normal text-gray-400">({canceledTrips.length})</span>
          </h3>
          <div className="grid gap-4">
            {canceledTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                canEdit={canEdit}
                onEdit={openEditForm}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface TripCardProps {
  trip: any;
  canEdit: boolean;
  onEdit: (trip: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (trip: any, newStatus: TripStatus) => void;
}

function TripCard({ trip, canEdit, onEdit, onDelete, onStatusChange }: TripCardProps) {
  const status: TripStatus = trip.status ?? 'PROPOSED';
  const nextStatuses = NEXT_STATUSES[status] ?? [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h4 className="text-lg font-bold text-gray-800 truncate">{trip.title}</h4>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-2">📍 {trip.destination}</p>
          {(trip.startDate || trip.endDate) && (
            <p className="text-sm text-gray-500 mb-2">
              📅{' '}
              {trip.startDate ? trip.startDate : '?'} → {trip.endDate ? trip.endDate : '?'}
            </p>
          )}
          {trip.description && (
            <p className="text-sm text-gray-600 mb-2">{trip.description}</p>
          )}
          {trip.planningNotes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
              <p className="text-xs font-semibold text-yellow-700 mb-1">📝 Planning Notes</p>
              <p className="text-sm text-yellow-900 whitespace-pre-wrap">{trip.planningNotes}</p>
            </div>
          )}
          {trip.bookedAt && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              ✅ Booked on {new Date(trip.bookedAt).toLocaleDateString()}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">Created by: {trip.createdBy}</p>
        </div>

        {canEdit && (
          <div className="flex flex-col gap-2 ml-4 flex-shrink-0">
            {/* Next status actions */}
            {nextStatuses.map((nextStatus) => (
              <button
                key={nextStatus}
                onClick={() => onStatusChange(trip, nextStatus)}
                className={`text-sm px-3 py-1.5 rounded-lg transition ${
                  nextStatus === 'BOOKED'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : nextStatus === 'CANCELED'
                    ? 'bg-red-100 hover:bg-red-200 text-red-700'
                    : 'bg-royal-blue-100 hover:bg-royal-blue-200 text-royal-blue-700'
                }`}
              >
                {nextStatus === 'BOOKED'
                  ? '✅ Move to Booked'
                  : nextStatus === 'PLANNING'
                  ? '▶ Start Planning'
                  : '🚫 Cancel'}
              </button>
            ))}
            {/* Edit / Delete */}
            {status !== 'BOOKED' && (
              <button
                onClick={() => onEdit(trip)}
                className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                ✏️ Edit
              </button>
            )}
            <button
              onClick={() => onDelete(trip.id)}
              className="text-sm px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
            >
              🗑 Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
