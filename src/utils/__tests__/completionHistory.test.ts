import { describe, it, expect } from 'vitest';
import {
  filterCompletions,
  computeCompletionStats,
  deriveKnownChildren,
} from '../completionHistory';
import type { CompletionRecord } from '../completionHistory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHORES = [
  { id: 'c1', title: 'Vacuum' },
  { id: 'c2', title: 'Dishes' },
  { id: 'c3', title: 'Laundry' },
];

const ASSIGNMENTS = [
  { choreId: 'c1', assignedTo: 'alice@example.com' },
  { choreId: 'c2', assignedTo: 'alice@example.com' },
  { choreId: 'c3', assignedTo: 'bob@example.com' },
];

function makeCompletion(
  id: string,
  choreId: string,
  completedBy: string,
  completedAt: string,
  extra: { notes?: string; pointsEarned?: number } = {}
) {
  return { id, choreId, completedBy, completedAt, ...extra };
}

const COMPLETIONS = [
  makeCompletion('x1', 'c1', 'alice@example.com', '2024-03-01T10:00:00.000Z', { pointsEarned: 5 }),
  makeCompletion('x2', 'c2', 'alice@example.com', '2024-03-05T12:00:00.000Z', { pointsEarned: 3 }),
  makeCompletion('x3', 'c3', 'bob@example.com',   '2024-03-03T09:00:00.000Z', { pointsEarned: 4 }),
  makeCompletion('x4', 'c1', 'alice@example.com', '2024-04-01T10:00:00.000Z', { pointsEarned: 5 }),
];

// ---------------------------------------------------------------------------
// filterCompletions
// ---------------------------------------------------------------------------

describe('filterCompletions – no filters', () => {
  it('returns all completions when no options given', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, {});
    expect(result).toHaveLength(4);
  });

  it('enriches each record with choreTitle', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, {});
    const rec = result.find((r) => r.id === 'x1');
    expect(rec?.choreTitle).toBe('Vacuum');
  });

  it('falls back to choreId when chore is unknown', () => {
    const result = filterCompletions(
      [makeCompletion('y1', 'unknown-id', 'alice@example.com', '2024-03-01T00:00:00.000Z')],
      CHORES,
      {}
    );
    expect(result[0].choreTitle).toBe('unknown-id');
  });

  it('returns records sorted newest-first', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, {});
    expect(result[0].id).toBe('x4'); // April
    expect(result[result.length - 1].id).toBe('x1'); // March 1
  });
});

describe('filterCompletions – child filter', () => {
  it('returns only completions for the specified child', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, { child: 'alice@example.com' });
    expect(result.every((r) => r.completedBy === 'alice@example.com')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no completions match child', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, { child: 'nobody@example.com' });
    expect(result).toHaveLength(0);
  });
});

describe('filterCompletions – date range filter', () => {
  it('filters by startDate (inclusive)', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, { startDate: '2024-03-05' });
    // x2 (2024-03-05), x4 (2024-04-01)
    expect(result.map((r) => r.id).sort()).toEqual(['x2', 'x4'].sort());
  });

  it('filters by endDate (inclusive)', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, { endDate: '2024-03-03' });
    // x1 (2024-03-01), x3 (2024-03-03)
    expect(result.map((r) => r.id).sort()).toEqual(['x1', 'x3'].sort());
  });

  it('filters by both startDate and endDate', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, {
      startDate: '2024-03-03',
      endDate: '2024-03-05',
    });
    expect(result.map((r) => r.id).sort()).toEqual(['x2', 'x3'].sort());
  });

  it('returns empty when range excludes all records', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
    expect(result).toHaveLength(0);
  });
});

describe('filterCompletions – combined child + date range', () => {
  it('applies both child and date range together', () => {
    const result = filterCompletions(COMPLETIONS, CHORES, {
      child: 'alice@example.com',
      startDate: '2024-03-01',
      endDate: '2024-03-31',
    });
    // x1 (alice, march 1) and x2 (alice, march 5)
    expect(result.map((r) => r.id).sort()).toEqual(['x1', 'x2'].sort());
  });
});

// ---------------------------------------------------------------------------
// computeCompletionStats
// ---------------------------------------------------------------------------

describe('computeCompletionStats', () => {
  it('returns zero stats for empty completions', () => {
    const stats = computeCompletionStats([], ASSIGNMENTS);
    expect(stats.totalCompletions).toBe(0);
    expect(stats.uniqueChoresCompleted).toBe(0);
    expect(stats.totalPointsEarned).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it('counts total completions correctly', () => {
    const filtered = filterCompletions(COMPLETIONS, CHORES, { child: 'alice@example.com' });
    const stats = computeCompletionStats(filtered, ASSIGNMENTS, 'alice@example.com');
    expect(stats.totalCompletions).toBe(3);
  });

  it('counts unique chores completed (not raw count)', () => {
    // alice completed c1 twice, c2 once → 2 unique
    const filtered = filterCompletions(COMPLETIONS, CHORES, { child: 'alice@example.com' });
    const stats = computeCompletionStats(filtered, ASSIGNMENTS, 'alice@example.com');
    expect(stats.uniqueChoresCompleted).toBe(2);
  });

  it('uses total assigned chores for the selected child', () => {
    // alice is assigned c1 and c2 → totalAssigned = 2
    const filtered = filterCompletions(COMPLETIONS, CHORES, { child: 'alice@example.com' });
    const stats = computeCompletionStats(filtered, ASSIGNMENTS, 'alice@example.com');
    expect(stats.totalAssigned).toBe(2);
  });

  it('calculates completion rate as percentage', () => {
    // alice completed c1 + c2 (2 of 2 assigned) → 100%
    const filtered = filterCompletions(COMPLETIONS, CHORES, { child: 'alice@example.com' });
    const stats = computeCompletionStats(filtered, ASSIGNMENTS, 'alice@example.com');
    expect(stats.completionRate).toBe(100);
  });

  it('calculates partial completion rate', () => {
    // alice completed only c1 in March → 1 of 2 assigned = 50%
    const filtered = filterCompletions(COMPLETIONS, CHORES, {
      child: 'alice@example.com',
      startDate: '2024-03-01',
      endDate: '2024-03-02',
    });
    const stats = computeCompletionStats(filtered, ASSIGNMENTS, 'alice@example.com');
    expect(stats.completionRate).toBe(50);
  });

  it('sums pointsEarned correctly', () => {
    const filtered = filterCompletions(COMPLETIONS, CHORES, { child: 'alice@example.com' });
    const stats = computeCompletionStats(filtered, ASSIGNMENTS, 'alice@example.com');
    expect(stats.totalPointsEarned).toBe(13); // 5+3+5
  });

  it('treats null/undefined pointsEarned as 0', () => {
    const recs: CompletionRecord[] = [
      { id: 'z1', choreId: 'c1', choreTitle: 'Vacuum', completedBy: 'u', completedAt: '2024-01-01T00:00:00.000Z', pointsEarned: null },
    ];
    const stats = computeCompletionStats(recs, []);
    expect(stats.totalPointsEarned).toBe(0);
  });

  it('returns completionRate 0 when no assignments exist', () => {
    const recs: CompletionRecord[] = [
      { id: 'z1', choreId: 'c1', choreTitle: 'Vacuum', completedBy: 'u', completedAt: '2024-01-01T00:00:00.000Z' },
    ];
    const stats = computeCompletionStats(recs, []);
    expect(stats.completionRate).toBe(0);
  });

  it('uses all assignments when no child filter given', () => {
    // No child → all 3 assignments, 3 unique chores completed (c1, c2, c3)
    const filtered = filterCompletions(COMPLETIONS, CHORES, {});
    const stats = computeCompletionStats(filtered, ASSIGNMENTS);
    expect(stats.totalAssigned).toBe(3);
    expect(stats.completionRate).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// deriveKnownChildren
// ---------------------------------------------------------------------------

describe('deriveKnownChildren', () => {
  it('returns unique users from completions and assignments', () => {
    const children = deriveKnownChildren(COMPLETIONS, ASSIGNMENTS);
    expect(children).toContain('alice@example.com');
    expect(children).toContain('bob@example.com');
  });

  it('deduplicates users that appear in both', () => {
    const children = deriveKnownChildren(
      [makeCompletion('z1', 'c1', 'alice@example.com', '2024-01-01T00:00:00.000Z')],
      [{ assignedTo: 'alice@example.com', choreId: 'c1' }]
    );
    expect(children.filter((c) => c === 'alice@example.com')).toHaveLength(1);
  });

  it('returns an empty array when no data exists', () => {
    expect(deriveKnownChildren([], [])).toHaveLength(0);
  });

  it('returns results in sorted order', () => {
    const children = deriveKnownChildren(COMPLETIONS, ASSIGNMENTS);
    const sorted = [...children].sort();
    expect(children).toEqual(sorted);
  });
});
