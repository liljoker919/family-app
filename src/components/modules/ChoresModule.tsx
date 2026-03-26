import { useState, useEffect, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { FamilyRole } from '../../utils/familyContext';
import { isChoreToday, isChoreThisWeek } from '../../utils/choresDue';
import KidChoresView from './KidChoresView';

const client = generateClient<Schema>();

const MANAGER_GROUPS = ['ADMIN', 'PLANNER'] as const;

interface ChoresModuleProps {
  user: any;
  familyId: string;
  role: FamilyRole;
}

const RECURRENCES = ['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME'] as const;
type ChoreRecurrence = typeof RECURRENCES[number];

const RECURRENCE_LABELS: Record<ChoreRecurrence, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  ONE_TIME: 'One Time',
};

const CATEGORIES = ['CLEANING', 'LAUNDRY', 'COOKING', 'YARD', 'PETS', 'ERRANDS', 'OTHER'] as const;
type ChoreCategory = typeof CATEGORIES[number];

const CATEGORY_LABELS: Record<ChoreCategory, string> = {
  CLEANING: 'Cleaning',
  LAUNDRY: 'Laundry',
  COOKING: 'Cooking',
  YARD: 'Yard',
  PETS: 'Pets',
  ERRANDS: 'Errands',
  OTHER: 'Other',
};

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type DayOfWeek = typeof DAYS_OF_WEEK[number];

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

const RECURRENCE_COLORS: Record<ChoreRecurrence, string> = {
  DAILY: 'bg-green-100 text-green-700',
  WEEKLY: 'bg-blue-100 text-blue-700',
  MONTHLY: 'bg-purple-100 text-purple-700',
  ONE_TIME: 'bg-gray-100 text-gray-600',
};

type ActiveTab = 'my-chores' | 'chores' | 'assignments' | 'completions';

export default function ChoresModule({ user, familyId, role }: ChoresModuleProps) {
  const [chores, setChores] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('my-chores');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterRecurrence, setFilterRecurrence] = useState<string>('ALL');
  const [filterDue, setFilterDue] = useState<'ALL' | 'TODAY' | 'THIS_WEEK'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Chore form state
  const [showChoreForm, setShowChoreForm] = useState(false);
  const [editingChore, setEditingChore] = useState<any>(null);
  const [choreForm, setChoreForm] = useState({
    title: '',
    description: '',
    recurrence: 'WEEKLY' as ChoreRecurrence,
    daysOfWeek: [] as string[],
    category: 'CLEANING' as ChoreCategory,
    pointValue: '',
    isActive: true,
  });

  // Assignment form state
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assigningChore, setAssigningChore] = useState<any>(null);
  const [assignForm, setAssignForm] = useState({
    assignedTo: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Completion form state
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completingChore, setCompletingChore] = useState<any>(null);
  const [completeForm, setCompleteForm] = useState({
    completedBy: '',
    completedAt: '',
    notes: '',
  });

  // Form feedback state
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentUser = user?.signInDetails?.loginId || 'Unknown';

  useEffect(() => {
    fetchChores();
    fetchCompletions();
    fetchAssignments();
  }, []);

  const canManage = useMemo(
    () => MANAGER_GROUPS.includes(role as typeof MANAGER_GROUPS[number]),
    [role]
  );

  const fetchChores = async () => {
    try {
      const { data } = await client.models.Chore.list({
        filter: { familyId: { eq: familyId } },
      });
      setChores(data);
    } catch (error) {
      console.error('Error fetching chores:', error);
    }
  };

  const fetchCompletions = async () => {
    try {
      const { data } = await client.models.ChoreCompletion.list();
      setCompletions(data);
    } catch (error) {
      console.error('Error fetching completions:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data } = await client.models.ChoreAssignment.list();
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const resetChoreForm = () => {
    setChoreForm({
      title: '',
      description: '',
      recurrence: 'WEEKLY',
      daysOfWeek: [],
      category: 'CLEANING',
      pointValue: '',
      isActive: true,
    });
    setEditingChore(null);
  };

  const openCreateChoreForm = () => {
    resetChoreForm();
    setFormError(null);
    setFormSuccess(null);
    setShowChoreForm(true);
  };

  const openEditChoreForm = (chore: any) => {
    setChoreForm({
      title: chore.title || '',
      description: chore.description || '',
      recurrence: (chore.recurrence as ChoreRecurrence) || 'WEEKLY',
      daysOfWeek: chore.daysOfWeek || [],
      category: (chore.category as ChoreCategory) || 'CLEANING',
      pointValue: chore.pointValue != null ? String(chore.pointValue) : '',
      isActive: chore.isActive !== false,
    });
    setEditingChore(chore);
    setFormError(null);
    setFormSuccess(null);
    setShowChoreForm(true);
  };

  const toggleDayOfWeek = (day: string) => {
    setChoreForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleChoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSaving(true);
    try {
      const payload = {
        familyId,
        title: choreForm.title,
        description: choreForm.description || undefined,
        recurrence: choreForm.recurrence,
        daysOfWeek: choreForm.recurrence === 'WEEKLY' && choreForm.daysOfWeek.length > 0
          ? choreForm.daysOfWeek
          : undefined,
        category: choreForm.category,
        pointValue: choreForm.pointValue !== '' ? parseInt(choreForm.pointValue) : undefined,
        isActive: choreForm.isActive,
        createdBy: currentUser,
      };

      if (editingChore) {
        await client.models.Chore.update({ id: editingChore.id, ...payload });
      } else {
        await client.models.Chore.create(payload);
      }
      setShowChoreForm(false);
      resetChoreForm();
      const successMsg = editingChore ? 'Chore updated successfully.' : 'Chore created successfully.';
      setFormSuccess(successMsg);
      try {
        await fetchChores();
      } catch {
        setFormSuccess(successMsg + ' (List may be stale — please refresh.)');
      }
    } catch (error) {
      console.error('Error saving chore:', error);
      setFormError('Failed to save chore. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChore = async (id: string) => {
    if (confirm('Are you sure you want to delete this chore?')) {
      try {
        await client.models.Chore.delete({ id });
        fetchChores();
      } catch (error) {
        console.error('Error deleting chore:', error);
      }
    }
  };

  const handleToggleChoreActive = async (chore: any) => {
    try {
      await client.models.Chore.update({ id: chore.id, isActive: !chore.isActive });
      fetchChores();
    } catch (error) {
      console.error('Error updating chore:', error);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (confirm('Remove this assignment?')) {
      try {
        await client.models.ChoreAssignment.delete({ id });
        fetchAssignments();
      } catch (error) {
        console.error('Error deleting assignment:', error);
      }
    }
  };

  const openAssignForm = (chore: any) => {
    setAssigningChore(chore);
    setAssignForm({ assignedTo: '', startDate: '', endDate: '', notes: '' });
    setShowAssignForm(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.models.ChoreAssignment.create({
        choreId: assigningChore.id,
        assignedTo: assignForm.assignedTo,
        assignedBy: currentUser,
        startDate: assignForm.startDate || undefined,
        endDate: assignForm.endDate || undefined,
        notes: assignForm.notes || undefined,
      });
      setShowAssignForm(false);
      setAssigningChore(null);
    } catch (error) {
      console.error('Error creating assignment:', error);
    }
  };

  const openCompleteForm = (chore: any) => {
    setCompletingChore(chore);
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCompleteForm({
      completedBy: currentUser,
      completedAt: localIso,
      notes: '',
    });
    setShowCompleteForm(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pointsEarned = completingChore.pointValue ?? undefined;
      await client.models.ChoreCompletion.create({
        choreId: completingChore.id,
        completedBy: completeForm.completedBy,
        completedAt: new Date(completeForm.completedAt).toISOString(),
        notes: completeForm.notes || undefined,
        pointsEarned,
      });
      setShowCompleteForm(false);
      setCompletingChore(null);
      fetchCompletions();
    } catch (error) {
      console.error('Error logging completion:', error);
    }
  };

  const handleDeleteCompletion = async (id: string) => {
    if (confirm('Delete this completion record?')) {
      try {
        await client.models.ChoreCompletion.delete({ id });
        fetchCompletions();
      } catch (error) {
        console.error('Error deleting completion:', error);
      }
    }
  };

  const filteredChores = chores.filter((c) => {
    const catMatch = filterCategory === 'ALL' || c.category === filterCategory;
    const recMatch = filterRecurrence === 'ALL' || c.recurrence === filterRecurrence;
    const dueMatch =
      filterDue === 'ALL' ||
      (filterDue === 'TODAY' && isChoreToday(c)) ||
      (filterDue === 'THIS_WEEK' && isChoreThisWeek(c));
    const activeMatch =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && c.isActive !== false) ||
      (filterStatus === 'INACTIVE' && c.isActive === false);
    return catMatch && recMatch && dueMatch && activeMatch;
  });

  // Set of choreIds assigned to the current user
  const myAssignedChoreIds = useMemo(
    () => new Set(
      assignments
        .filter((a) => a.assignedTo === currentUser)
        .map((a) => a.choreId)
    ),
    [assignments, currentUser]
  );

  const sortedCompletions = [...completions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  // Members only see their own completions
  const visibleCompletions = canManage
    ? sortedCompletions
    : sortedCompletions.filter((c) => c.completedBy === currentUser);

  const choreMap: Record<string, any> = {};
  chores.forEach((c) => { choreMap[c.id] = c; });

  return (
    <div>
      {formSuccess && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex justify-between items-center">
          <span>{formSuccess}</span>
          <button onClick={() => setFormSuccess(null)} className="text-green-500 hover:text-green-700 ml-4 font-bold">&times;</button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Chores</h2>
        {canManage && (
          <button
            onClick={openCreateChoreForm}
            className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-6 py-2 rounded-lg transition"
          >
            Add Chore
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['my-chores', 'chores', 'assignments', 'completions'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-medium rounded-t-lg transition ${
              activeTab === tab
                ? 'bg-white border border-b-white border-gray-200 text-royal-blue-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'my-chores'
              ? 'My Chores'
              : tab === 'chores'
              ? 'All Chores'
              : tab === 'assignments'
              ? 'Assignments'
              : 'Completion History'}
          </button>
        ))}
      </div>

      {/* ---- MY CHORES TAB ---- */}
      {activeTab === 'my-chores' && <KidChoresView user={user} />}

      {/* ---- CHORES TAB ---- */}
      {activeTab === 'chores' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600 self-center">Category:</span>
              <button
                onClick={() => setFilterCategory('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  filterCategory === 'ALL' ? 'bg-royal-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filterCategory === cat ? 'bg-royal-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600 self-center">Recurrence:</span>
              <button
                onClick={() => setFilterRecurrence('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  filterRecurrence === 'ALL' ? 'bg-royal-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {RECURRENCES.map((rec) => (
                <button
                  key={rec}
                  onClick={() => setFilterRecurrence(rec)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filterRecurrence === rec ? 'bg-royal-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {RECURRENCE_LABELS[rec]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600 self-center">Due:</span>
              {(['ALL', 'TODAY', 'THIS_WEEK'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilterDue(opt)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filterDue === opt ? 'bg-royal-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt === 'ALL' ? 'All' : opt === 'TODAY' ? 'Today' : 'This Week'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600 self-center">Status:</span>
              {(['ACTIVE', 'INACTIVE', 'ALL'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilterStatus(opt)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filterStatus === opt ? 'bg-royal-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt === 'ALL' ? 'All' : opt === 'ACTIVE' ? 'Active' : 'Archived'}
                </button>
              ))}
            </div>
          </div>

          {/* Chore List */}
          {filteredChores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-lg font-medium">No chores found</p>
              <p className="text-sm">Add your first chore to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChores.map((chore) => (
                <div
                  key={chore.id}
                  className={`bg-white rounded-lg shadow p-5 flex items-start justify-between gap-4 ${
                    chore.isActive === false ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-800">{chore.title}</h3>
                      {chore.isActive === false && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                      {chore.recurrence && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECURRENCE_COLORS[chore.recurrence as ChoreRecurrence] || 'bg-gray-100 text-gray-600'}`}>
                          {RECURRENCE_LABELS[chore.recurrence as ChoreRecurrence] || chore.recurrence}
                        </span>
                      )}
                      {chore.category && (
                        <span className="text-xs bg-royal-blue-100 text-royal-blue-700 px-2 py-0.5 rounded-full">
                          {CATEGORY_LABELS[chore.category as ChoreCategory] || chore.category}
                        </span>
                      )}
                      {chore.pointValue != null && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          {chore.pointValue} pts
                        </span>
                      )}
                    </div>
                    {chore.description && (
                      <p className="text-sm text-gray-500 mb-1">{chore.description}</p>
                    )}
                    {chore.recurrence === 'WEEKLY' && chore.daysOfWeek && chore.daysOfWeek.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {(chore.daysOfWeek as string[]).map((d) => (
                          <span key={d} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                            {DAY_LABELS[d as DayOfWeek] || d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {(canManage || myAssignedChoreIds.has(chore.id)) && (
                      <button
                        onClick={() => openCompleteForm(chore)}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg transition text-sm font-medium"
                      >
                        ✓ Log Done
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => openAssignForm(chore)}
                          className="bg-royal-blue-50 hover:bg-royal-blue-100 text-royal-blue-700 px-3 py-1.5 rounded-lg transition text-sm"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => openEditChoreForm(chore)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleChoreActive(chore)}
                          className={`px-3 py-1.5 rounded-lg transition text-sm ${
                            chore.isActive !== false
                              ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                          }`}
                        >
                          {chore.isActive !== false ? 'Archive' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteChore(chore.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition text-sm"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- ASSIGNMENTS TAB ---- */}
      {activeTab === 'assignments' && (
        <>
          {assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-lg font-medium">No assignments yet</p>
              <p className="text-sm">Use the &ldquo;Assign&rdquo; button on a chore to assign it to a family member.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const chore = choreMap[assignment.choreId];
                return (
                  <div key={assignment.id} className="bg-white rounded-lg shadow p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800">
                          {chore ? chore.title : assignment.choreId}
                        </span>
                        {chore?.recurrence && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECURRENCE_COLORS[chore.recurrence as ChoreRecurrence] || 'bg-gray-100 text-gray-600'}`}>
                            {RECURRENCE_LABELS[chore.recurrence as ChoreRecurrence] || chore.recurrence}
                          </span>
                        )}
                        {chore?.isActive === false && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Archived</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Assigned to <span className="font-medium text-gray-800">{assignment.assignedTo}</span>
                        {' '}&mdash; by <span className="font-medium text-gray-700">{assignment.assignedBy}</span>
                      </p>
                      {(assignment.startDate || assignment.endDate) && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {assignment.startDate && <>From {assignment.startDate}</>}
                          {assignment.startDate && assignment.endDate && ' → '}
                          {assignment.endDate && <>Until {assignment.endDate}</>}
                        </p>
                      )}
                      {assignment.notes && (
                        <p className="text-sm text-gray-400 mt-1 italic">{assignment.notes}</p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="shrink-0 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---- COMPLETIONS TAB ---- */}
      {activeTab === 'completions' && (
        <>
          {visibleCompletions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-lg font-medium">No completions yet</p>
              <p className="text-sm">Mark a chore as done to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCompletions.map((comp) => {
                const chore = choreMap[comp.choreId];
                return (
                  <div key={comp.id} className="bg-white rounded-lg shadow p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-green-600 font-medium text-sm">✓</span>
                        <span className="font-semibold text-gray-800">
                          {chore ? chore.title : comp.choreId}
                        </span>
                        {comp.pointsEarned != null && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            +{comp.pointsEarned} pts
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Completed by <span className="font-medium text-gray-700">{comp.completedBy}</span>
                        {' '}&mdash;{' '}
                        {new Date(comp.completedAt).toLocaleString()}
                      </p>
                      {comp.notes && (
                        <p className="text-sm text-gray-400 mt-1 italic">{comp.notes}</p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleDeleteCompletion(comp.id)}
                        className="shrink-0 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---- CHORE FORM MODAL ---- */}
      {showChoreForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">
              {editingChore ? 'Edit Chore' : 'Add New Chore'}
            </h3>
            {formError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}
            <form onSubmit={handleChoreSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={choreForm.title}
                  onChange={(e) => setChoreForm({ ...choreForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="e.g. Vacuum Living Room"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={choreForm.description}
                  onChange={(e) => setChoreForm({ ...choreForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Optional details about this chore"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={choreForm.category}
                    onChange={(e) => setChoreForm({ ...choreForm, category: e.target.value as ChoreCategory })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
                  <select
                    value={choreForm.recurrence}
                    onChange={(e) => setChoreForm({ ...choreForm, recurrence: e.target.value as ChoreRecurrence, daysOfWeek: [] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  >
                    {RECURRENCES.map((rec) => (
                      <option key={rec} value={rec}>{RECURRENCE_LABELS[rec]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {choreForm.recurrence === 'WEEKLY' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(day)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          choreForm.daysOfWeek.includes(day)
                            ? 'bg-royal-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Point Value</label>
                  <input
                    type="number"
                    min="0"
                    value={choreForm.pointValue}
                    onChange={(e) => setChoreForm({ ...choreForm, pointValue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={choreForm.isActive}
                      onChange={(e) => setChoreForm({ ...choreForm, isActive: e.target.checked })}
                      className="w-4 h-4 text-royal-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2 rounded-lg transition"
                >
                  {isSaving ? 'Saving…' : editingChore ? 'Update Chore' : 'Save Chore'}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => { setShowChoreForm(false); resetChoreForm(); setFormError(null); setFormSuccess(null); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- ASSIGN FORM MODAL ---- */}
      {showAssignForm && assigningChore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-1">Assign Chore</h3>
            <p className="text-sm text-gray-500 mb-4">{assigningChore.title}</p>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                <input
                  type="text"
                  value={assignForm.assignedTo}
                  onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="e.g. Alex, Mom, Dad"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white py-2 rounded-lg transition"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAssignForm(false); setAssigningChore(null); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- COMPLETE FORM MODAL ---- */}
      {showCompleteForm && completingChore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-1">Log Completion</h3>
            <p className="text-sm text-gray-500 mb-4">{completingChore.title}</p>
            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completed By *</label>
                <input
                  type="text"
                  value={completeForm.completedBy}
                  onChange={(e) => setCompleteForm({ ...completeForm, completedBy: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="e.g. Alex"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completed At *</label>
                <input
                  type="datetime-local"
                  value={completeForm.completedAt}
                  onChange={(e) => setCompleteForm({ ...completeForm, completedAt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue-500 focus:border-transparent"
                  placeholder="Optional notes"
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
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
                >
                  Log Completion
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCompleteForm(false); setCompletingChore(null); }}
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
