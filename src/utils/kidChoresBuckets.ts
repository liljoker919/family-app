/**
 * Kid View – Chore Bucketing Logic
 *
 * Pure function that sorts a child's assigned chores into "Today" and
 * "This Week (but not today)" buckets, and marks each as done or pending
 * based on existing completion records.  Having no external dependencies
 * makes this easy to unit-test without mocking AWS Amplify.
 */

import { isChoreToday, isChoreThisWeek } from './choresDue';

export interface KidChoreItem {
  id: string;
  title: string;
  recurrence?: string | null;
  daysOfWeek?: (string | null)[] | null;
  isActive?: boolean | null;
  category?: string | null;
  pointValue?: number | null;
  description?: string | null;
}

export interface KidAssignmentItem {
  choreId: string;
  assignedTo: string;
}

export interface KidCompletionItem {
  choreId: string;
  completedBy: string;
  completedAt: string;
}

export interface KidChoreEntry {
  chore: KidChoreItem;
  isDone: boolean;
}

export interface KidChoresBuckets {
  /** Chores that are due on the same calendar day as `now`. */
  todayChores: KidChoreEntry[];
  /** Chores due somewhere in the ISO week of `now`, but NOT due today. */
  weekChores: KidChoreEntry[];
}

/**
 * Builds Today / This Week buckets for the logged-in child.
 *
 * @param chores       - All chore records in the system.
 * @param assignments  - All chore-assignment records.
 * @param completions  - All completion records.
 * @param currentUser  - The logged-in user's identifier (e.g. loginId).
 * @param now          - Reference date/time (defaults to `new Date()`).
 */
export function buildKidChoresBuckets(
  chores: KidChoreItem[],
  assignments: KidAssignmentItem[],
  completions: KidCompletionItem[],
  currentUser: string,
  now: Date = new Date()
): KidChoresBuckets {
  // Step 1: collect chore IDs assigned to the current user.
  const assignedIds = new Set(
    assignments
      .filter((a) => a.assignedTo === currentUser)
      .map((a) => a.choreId)
  );

  // Step 2: narrow to active chores assigned to this user.
  const myChores = chores.filter(
    (c) => assignedIds.has(c.id) && c.isActive !== false
  );

  // Step 3: determine which chore IDs are already done today / this week.
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const jsDay = now.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay; // Mon = 1 … Sun = 7
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoDay - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const doneTodayIds = new Set<string>();
  const doneThisWeekIds = new Set<string>();

  for (const c of completions) {
    if (c.completedBy !== currentUser) continue;
    const completedDate = new Date(c.completedAt);
    const completedDay = new Date(
      completedDate.getFullYear(),
      completedDate.getMonth(),
      completedDate.getDate()
    ).getTime();

    if (completedDay === todayStr) doneTodayIds.add(c.choreId);
    if (completedDate >= weekStart && completedDate < weekEnd) doneThisWeekIds.add(c.choreId);
  }

  // Step 4: bucket and annotate.
  const todayChores: KidChoreEntry[] = [];
  const weekChores: KidChoreEntry[] = [];

  for (const chore of myChores) {
    if (isChoreToday(chore, now)) {
      todayChores.push({ chore, isDone: doneTodayIds.has(chore.id) });
    } else if (isChoreThisWeek(chore, now)) {
      weekChores.push({ chore, isDone: doneThisWeekIds.has(chore.id) });
    }
  }

  return { todayChores, weekChores };
}
