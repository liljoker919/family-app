export interface CompletionRecord {
  id: string;
  choreId: string;
  choreTitle: string;
  completedBy: string;
  completedAt: string;
  notes?: string | null;
  pointsEarned?: number | null;
}

export interface CompletionStats {
  totalCompletions: number;
  uniqueChoresCompleted: number;
  totalAssigned: number;
  completionRate: number; // 0-100
  totalPointsEarned: number;
}

/**
 * Filter raw completion records by child and/or date range, returning
 * enriched records sorted newest-first.
 */
export function filterCompletions(
  completions: Array<{
    id: string;
    choreId: string;
    completedBy: string;
    completedAt: string;
    notes?: string | null;
    pointsEarned?: number | null;
  }>,
  chores: Array<{ id: string; title: string }>,
  options: {
    child?: string;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  } = {}
): CompletionRecord[] {
  const choreMap = new Map(chores.map((c) => [c.id, c.title]));

  return completions
    .filter((c) => {
      if (options.child && c.completedBy !== options.child) return false;
      const date = c.completedAt.slice(0, 10);
      if (options.startDate && date < options.startDate) return false;
      if (options.endDate && date > options.endDate) return false;
      return true;
    })
    .map((c) => ({
      id: c.id,
      choreId: c.choreId,
      choreTitle: choreMap.get(c.choreId) ?? c.choreId,
      completedBy: c.completedBy,
      completedAt: c.completedAt,
      notes: c.notes,
      pointsEarned: c.pointsEarned,
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/**
 * Derive known children (unique completedBy values + assignedTo values).
 */
export function deriveKnownChildren(
  completions: Array<{ completedBy: string }>,
  assignments: Array<{ assignedTo: string }>
): string[] {
  const users = new Set<string>();
  completions.forEach((c) => users.add(c.completedBy));
  assignments.forEach((a) => users.add(a.assignedTo));
  return Array.from(users).sort();
}

/**
 * Compute summary statistics for a set of filtered completions.
 * Completion rate = unique chores completed ÷ total chores assigned (to the selected child).
 */
export function computeCompletionStats(
  filteredCompletions: CompletionRecord[],
  assignments: Array<{ assignedTo: string; choreId: string }>,
  child?: string
): CompletionStats {
  const totalCompletions = filteredCompletions.length;
  const uniqueChoresCompleted = new Set(filteredCompletions.map((c) => c.choreId)).size;
  const totalPointsEarned = filteredCompletions.reduce(
    (sum, c) => sum + (c.pointsEarned ?? 0),
    0
  );

  const assignedChoreIds = new Set(
    assignments
      .filter((a) => !child || a.assignedTo === child)
      .map((a) => a.choreId)
  );
  const totalAssigned = assignedChoreIds.size;

  const completionRate =
    totalAssigned > 0 ? Math.round((uniqueChoresCompleted / totalAssigned) * 100) : 0;

  return {
    totalCompletions,
    uniqueChoresCompleted,
    totalAssigned,
    completionRate,
    totalPointsEarned,
  };
}
