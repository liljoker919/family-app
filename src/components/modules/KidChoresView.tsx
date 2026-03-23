import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { buildKidChoresBuckets } from '../../utils/kidChoresBuckets';
import type { KidChoreEntry, KidChoreItem } from '../../utils/kidChoresBuckets';

const client = generateClient<Schema>();

const CATEGORY_LABELS: Record<string, string> = {
  CLEANING: 'Cleaning',
  LAUNDRY: 'Laundry',
  COOKING: 'Cooking',
  YARD: 'Yard',
  PETS: 'Pets',
  ERRANDS: 'Errands',
  OTHER: 'Other',
};

const RECURRENCE_COLORS: Record<string, string> = {
  DAILY: 'bg-green-100 text-green-700',
  WEEKLY: 'bg-blue-100 text-blue-700',
  MONTHLY: 'bg-purple-100 text-purple-700',
  ONE_TIME: 'bg-gray-100 text-gray-600',
};

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  ONE_TIME: 'One Time',
};

interface KidChoresViewProps {
  user: any;
}

interface ChoreRowProps {
  entry: KidChoreEntry;
  onMarkDone: () => void;
}

function ChoreRow({ entry, onMarkDone }: ChoreRowProps) {
  const { chore, isDone } = entry;
  return (
    <div
      className={`bg-white rounded-lg shadow p-4 flex items-start justify-between gap-4 ${
        isDone ? 'opacity-70' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {isDone && (
            <span className="text-green-600 font-bold text-lg" aria-label="Completed">✓</span>
          )}
          <h4
            className={`text-base font-semibold ${
              isDone ? 'line-through text-gray-400' : 'text-gray-800'
            }`}
          >
            {chore.title}
          </h4>
          {isDone && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Done
            </span>
          )}
          {chore.recurrence && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                RECURRENCE_COLORS[chore.recurrence] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {RECURRENCE_LABELS[chore.recurrence] ?? chore.recurrence}
            </span>
          )}
          {chore.category && (
            <span className="text-xs bg-royal-blue-100 text-royal-blue-700 px-2 py-0.5 rounded-full">
              {CATEGORY_LABELS[chore.category] ?? chore.category}
            </span>
          )}
          {chore.pointValue != null && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
              {chore.pointValue} pts
            </span>
          )}
        </div>
        {chore.description && (
          <p className="text-sm text-gray-500">{chore.description}</p>
        )}
      </div>
      {!isDone && (
        <button
          onClick={onMarkDone}
          className="shrink-0 bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-lg transition text-sm font-medium"
        >
          ✓ Mark Done
        </button>
      )}
    </div>
  );
}

export default function KidChoresView({ user }: KidChoresViewProps) {
  const [chores, setChores] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completingChore, setCompletingChore] = useState<KidChoreItem | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUser = user?.signInDetails?.loginId || 'Unknown';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [choresResult, assignmentsResult, completionsResult] = await Promise.all([
        client.models.Chore.list(),
        client.models.ChoreAssignment.list(),
        client.models.ChoreCompletion.list(),
      ]);
      setChores(choresResult.data);
      setAssignments(assignmentsResult.data);
      setCompletions(completionsResult.data);
    } catch (error) {
      console.error('Error loading My Chores data:', error);
    } finally {
      setLoading(false);
    }
  };

  const { todayChores, weekChores } = useMemo(
    () => buildKidChoresBuckets(chores, assignments, completions, currentUser),
    [chores, assignments, completions, currentUser]
  );

  const openCompleteForm = (chore: KidChoreItem) => {
    setCompletingChore(chore);
    setCompleteNotes('');
    setShowCompleteForm(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingChore || submitting) return;

    // Lock immediately to prevent any re-entry before React re-renders.
    setSubmitting(true);

    // Prevent duplicate completion for the same due window.
    const inToday = todayChores.find((entry) => entry.chore.id === completingChore.id);
    const inWeek = weekChores.find((entry) => entry.chore.id === completingChore.id);
    if (inToday?.isDone || inWeek?.isDone) {
      setShowCompleteForm(false);
      setCompletingChore(null);
      setSubmitting(false);
      return;
    }

    // Capture values before closing the modal so the closure is stable.
    const choreToComplete = completingChore;
    const notes = completeNotes;
    const completedAt = new Date().toISOString();
    // Unique key used to identify and revert this specific optimistic record.
    const optimisticId = `${choreToComplete.id}-${completedAt}`;

    // Optimistically update the UI immediately so the chore shows as done
    // without waiting for the network round-trip.
    setCompletions((prev) => [
      ...prev,
      {
        choreId: choreToComplete.id,
        completedBy: currentUser,
        completedAt,
        notes: notes || undefined,
        pointsEarned: choreToComplete.pointValue ?? undefined,
        _optimisticId: optimisticId,
      },
    ]);
    setShowCompleteForm(false);
    setCompletingChore(null);

    try {
      await client.models.ChoreCompletion.create({
        choreId: choreToComplete.id,
        completedBy: currentUser,
        completedAt,
        notes: notes || undefined,
        pointsEarned: choreToComplete.pointValue ?? undefined,
      });
      // Sync full state in the background to pick up any other changes.
      loadData();
    } catch (error) {
      console.error('Error logging completion:', error);
      // Revert the optimistic update so the user can try again.
      setCompletions((prev) =>
        prev.filter((c) => (c as any)._optimisticId !== optimisticId)
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="w-8 h-8 mx-auto mb-3 animate-spin text-royal-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        Loading your chores…
      </div>
    );
  }

  const hasAnyChores = todayChores.length > 0 || weekChores.length > 0;

  return (
    <div>
      {!hasAnyChores && (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <p className="text-lg font-medium">No chores assigned to you yet</p>
          <p className="text-sm">Check back later or ask a parent to assign some chores.</p>
        </div>
      )}

      {/* ---- TODAY ---- */}
      {todayChores.length > 0 && (
        <section className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📅</span> Today
            <span className="ml-1 text-sm font-normal text-gray-500">
              ({todayChores.filter((e) => e.isDone).length}/{todayChores.length} done)
            </span>
          </h3>
          <div className="space-y-3">
            {todayChores.map((entry) => (
              <ChoreRow
                key={entry.chore.id}
                entry={entry}
                onMarkDone={() => openCompleteForm(entry.chore)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- THIS WEEK ---- */}
      {weekChores.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📆</span> This Week
            <span className="ml-1 text-sm font-normal text-gray-500">
              ({weekChores.filter((e) => e.isDone).length}/{weekChores.length} done)
            </span>
          </h3>
          <div className="space-y-3">
            {weekChores.map((entry) => (
              <ChoreRow
                key={entry.chore.id}
                entry={entry}
                onMarkDone={() => openCompleteForm(entry.chore)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- MARK DONE MODAL ---- */}
      {showCompleteForm && completingChore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-1">Mark Done ✓</h3>
            <p className="text-sm text-gray-500 mb-4">{completingChore.title}</p>
            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="Any notes about how it went?"
                />
              </div>
              {completingChore.pointValue != null && (
                <p className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
                  🏆 This chore awards <strong>{completingChore.pointValue} points</strong>
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-2 rounded-lg transition font-medium"
                >
                  {submitting ? 'Saving…' : 'Done! ✓'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCompleteForm(false);
                    setCompletingChore(null);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
