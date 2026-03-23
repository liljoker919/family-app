import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../../../amplify/data/resource';
import {
  filterCompletions,
  computeCompletionStats,
  deriveKnownChildren,
} from '../../utils/completionHistory';

const client = generateClient<Schema>();

const MANAGER_GROUPS = ['ADMIN', 'PLANNER'] as const;

interface ReportingModuleProps {
  user: any;
}

export default function ReportingModule({ user }: ReportingModuleProps) {
  const [chores, setChores] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterChild, setFilterChild] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    Promise.all([loadUserGroups(), fetchData()]).finally(() => setLoading(false));
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

  const fetchData = async () => {
    try {
      const [choresRes, completionsRes, assignmentsRes] = await Promise.all([
        client.models.Chore.list(),
        client.models.ChoreCompletion.list(),
        client.models.ChoreAssignment.list(),
      ]);
      setChores(choresRes.data);
      setCompletions(completionsRes.data);
      setAssignments(assignmentsRes.data);
    } catch (error) {
      console.error('Error fetching reporting data:', error);
    }
  };

  const canManage = useMemo(
    () =>
      userGroups.some((g) =>
        MANAGER_GROUPS.includes(g as (typeof MANAGER_GROUPS)[number])
      ),
    [userGroups]
  );

  const knownChildren = useMemo(
    () => deriveKnownChildren(completions, assignments),
    [completions, assignments]
  );

  const filteredRecords = useMemo(
    () =>
      filterCompletions(completions, chores, {
        child: filterChild !== 'ALL' ? filterChild : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      }),
    [completions, chores, filterChild, filterStartDate, filterEndDate]
  );

  const stats = useMemo(
    () =>
      computeCompletionStats(
        filteredRecords,
        assignments,
        filterChild !== 'ALL' ? filterChild : undefined
      ),
    [filteredRecords, assignments, filterChild]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 text-lg">Loading…</div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
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
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a4 4 0 100-8 4 4 0 000 8z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-600">Access Restricted</p>
          <p className="text-sm text-gray-400">
            Only parents and admins can view completion history reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Completion History</h2>
        <button
          onClick={() => fetchData()}
          className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
          Filters
        </h3>
        <div className="flex flex-wrap gap-4">
          {/* Child filter */}
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Child / User</label>
            <select
              value={filterChild}
              onChange={(e) => setFilterChild(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Users</option>
              {knownChildren.map((child) => (
                <option key={child} value={child}>
                  {child}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
            />
          </div>

          {/* End date */}
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
            />
          </div>

          {/* Clear filters */}
          {(filterChild !== 'ALL' || filterStartDate || filterEndDate) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterChild('ALL');
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5 text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Total Completions
          </p>
          <p className="text-3xl font-bold text-royal-blue-700">{stats.totalCompletions}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Unique Chores Done
          </p>
          <p className="text-3xl font-bold text-green-600">{stats.uniqueChoresCompleted}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Completion Rate
          </p>
          <p className="text-3xl font-bold text-indigo-600">
            {stats.totalAssigned > 0 ? `${stats.completionRate}%` : '—'}
          </p>
          {stats.totalAssigned > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {stats.uniqueChoresCompleted} of {stats.totalAssigned} assigned
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-5 text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Points Earned
          </p>
          <p className="text-3xl font-bold text-yellow-600">{stats.totalPointsEarned}</p>
        </div>
      </div>

      {/* Completion rate bar */}
      {stats.totalAssigned > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Completion Rate</span>
            <span className="text-sm font-semibold text-indigo-600">{stats.completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Completion records table */}
      {filteredRecords.length === 0 ? (
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="text-lg font-medium">No completion records found</p>
          <p className="text-sm">
            {filterChild !== 'ALL' || filterStartDate || filterEndDate
              ? 'Try adjusting or clearing the filters.'
              : 'Completion records will appear here once chores are marked done.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-lg shadow p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-green-600 font-medium text-sm">✓</span>
                  <span className="font-semibold text-gray-800">{rec.choreTitle}</span>
                  {rec.pointsEarned != null && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      +{rec.pointsEarned} pts
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Completed by{' '}
                  <span className="font-medium text-gray-700">{rec.completedBy}</span>
                  {' '}—{' '}
                  {new Date(rec.completedAt).toLocaleString()}
                </p>
                {rec.notes && (
                  <p className="text-sm text-gray-400 mt-1 italic">{rec.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
