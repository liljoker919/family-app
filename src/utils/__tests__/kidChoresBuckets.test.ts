import { describe, it, expect } from 'vitest';
import { buildKidChoresBuckets } from '../kidChoresBuckets';
import type { KidChoreItem, KidAssignmentItem, KidCompletionItem } from '../kidChoresBuckets';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Reference week: Mon 2024-03-18 … Sun 2024-03-24
const MON = localDate('2024-03-18');
const WED = localDate('2024-03-20');
const FRI = localDate('2024-03-22');
const SUN = localDate('2024-03-24');

const USER = 'kid@example.com';
const OTHER_USER = 'parent@example.com';

function makeChore(overrides: Partial<KidChoreItem> & { id: string }): KidChoreItem {
  return {
    title: 'Test chore',
    recurrence: 'DAILY',
    isActive: true,
    ...overrides,
  };
}

function makeAssignment(choreId: string, assignedTo = USER): KidAssignmentItem {
  return { choreId, assignedTo };
}

function makeCompletion(
  choreId: string,
  completedAt: string,
  completedBy = USER
): KidCompletionItem {
  return { choreId, completedBy, completedAt: new Date(completedAt).toISOString() };
}

// ---------------------------------------------------------------------------
// Assignment filtering
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – assignment filtering', () => {
  it('returns empty buckets when the user has no assignments', () => {
    const chores = [makeChore({ id: 'c1' })];
    const assignments: KidAssignmentItem[] = [];
    const { todayChores, weekChores } = buildKidChoresBuckets(chores, assignments, [], USER, MON);
    expect(todayChores).toHaveLength(0);
    expect(weekChores).toHaveLength(0);
  });

  it('includes only chores assigned to the current user', () => {
    const chores = [
      makeChore({ id: 'c1', recurrence: 'DAILY' }),
      makeChore({ id: 'c2', recurrence: 'DAILY' }),
    ];
    const assignments = [makeAssignment('c1', USER), makeAssignment('c2', OTHER_USER)];
    const { todayChores } = buildKidChoresBuckets(chores, assignments, [], USER, MON);
    expect(todayChores.map((e) => e.chore.id)).toEqual(['c1']);
  });

  it('excludes inactive chores even if assigned to the user', () => {
    const chores = [makeChore({ id: 'c1', isActive: false })];
    const assignments = [makeAssignment('c1')];
    const { todayChores, weekChores } = buildKidChoresBuckets(chores, assignments, [], USER, MON);
    expect(todayChores).toHaveLength(0);
    expect(weekChores).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Today bucket
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – todayChores bucket', () => {
  it('puts a DAILY chore into todayChores', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    const { todayChores } = buildKidChoresBuckets(chores, [makeAssignment('c1')], [], USER, MON);
    expect(todayChores).toHaveLength(1);
    expect(todayChores[0].chore.id).toBe('c1');
  });

  it('puts a WEEKLY chore matching today into todayChores', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['MON'] })];
    const { todayChores, weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      MON
    );
    expect(todayChores).toHaveLength(1);
    expect(weekChores).toHaveLength(0);
  });

  it('does NOT put a MONTHLY chore into todayChores', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'MONTHLY' })];
    const { todayChores } = buildKidChoresBuckets(chores, [makeAssignment('c1')], [], USER, MON);
    expect(todayChores).toHaveLength(0);
  });

  it('does NOT put a ONE_TIME chore into todayChores', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'ONE_TIME' })];
    const { todayChores } = buildKidChoresBuckets(chores, [makeAssignment('c1')], [], USER, MON);
    expect(todayChores).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// This Week bucket
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – weekChores bucket', () => {
  it('puts a WEEKLY chore due later this week into weekChores (not todayChores)', () => {
    // Today is Monday; chore is due Wednesday.
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['WED'] })];
    const { todayChores, weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      MON
    );
    expect(todayChores).toHaveLength(0);
    expect(weekChores).toHaveLength(1);
    expect(weekChores[0].chore.id).toBe('c1');
  });

  it('does NOT put a WEEKLY chore due next week into weekChores', () => {
    // Today is Friday; chore is only due on Monday (already past this week from FRI perspective? No,
    // ISO week contains the past Monday too, so MON IS in the week.  Use Sunday instead.)
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['SUN'] })];
    const { weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      MON // today is Monday; chore is on Sunday of same week → in weekChores
    );
    expect(weekChores).toHaveLength(1);
  });

  it('a DAILY chore appears in todayChores only (not also in weekChores)', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    const { todayChores, weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      WED
    );
    expect(todayChores).toHaveLength(1);
    expect(weekChores).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isDone flag – Today bucket
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – isDone for todayChores', () => {
  it('marks isDone=false when no completion exists', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    const { todayChores } = buildKidChoresBuckets(chores, [makeAssignment('c1')], [], USER, MON);
    expect(todayChores[0].isDone).toBe(false);
  });

  it('marks isDone=true when completed today by the current user', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    // Completion on the same day as MON (2024-03-18), any time.
    const completions = [makeCompletion('c1', '2024-03-18T10:00:00')];
    const { todayChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      completions,
      USER,
      MON
    );
    expect(todayChores[0].isDone).toBe(true);
  });

  it('marks isDone=false when completed today but by a different user', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    const completions = [makeCompletion('c1', '2024-03-18T10:00:00', OTHER_USER)];
    const { todayChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      completions,
      USER,
      MON
    );
    expect(todayChores[0].isDone).toBe(false);
  });

  it('marks isDone=false when completion exists but on a different day', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    const completions = [makeCompletion('c1', '2024-03-17T22:00:00')]; // yesterday
    const { todayChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      completions,
      USER,
      MON
    );
    expect(todayChores[0].isDone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDone flag – This Week bucket
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – isDone for weekChores', () => {
  it('marks isDone=false when no completion exists this week', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['FRI'] })];
    const { weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      MON
    );
    expect(weekChores[0].isDone).toBe(false);
  });

  it('marks isDone=true when completed anywhere in the ISO week', () => {
    // Today is Monday; chore is due Friday; completion is on Wednesday.
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['FRI'] })];
    const completions = [makeCompletion('c1', '2024-03-20T09:00:00')]; // Wed
    const { weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      completions,
      USER,
      MON
    );
    expect(weekChores[0].isDone).toBe(true);
  });

  it('marks isDone=false when completion is from the previous week', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['FRI'] })];
    // Completion on previous week's Friday (2024-03-15)
    const completions = [makeCompletion('c1', '2024-03-15T09:00:00')];
    const { weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      completions,
      USER,
      MON
    );
    expect(weekChores[0].isDone).toBe(false);
  });

  it('marks isDone=false when completed this week but by a different user', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['FRI'] })];
    const completions = [makeCompletion('c1', '2024-03-20T09:00:00', OTHER_USER)];
    const { weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      completions,
      USER,
      MON
    );
    expect(weekChores[0].isDone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Multiple chores mixed
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – mixed chores', () => {
  it('correctly separates today and week chores from a mixed list', () => {
    const chores = [
      makeChore({ id: 'daily', recurrence: 'DAILY' }),
      makeChore({ id: 'wed', recurrence: 'WEEKLY', daysOfWeek: ['WED'] }),
      makeChore({ id: 'fri', recurrence: 'WEEKLY', daysOfWeek: ['FRI'] }),
      makeChore({ id: 'monthly', recurrence: 'MONTHLY' }),
    ];
    const assignments = chores.map((c) => makeAssignment(c.id));

    // Today is Monday.
    const { todayChores, weekChores } = buildKidChoresBuckets(
      chores,
      assignments,
      [],
      USER,
      MON
    );

    expect(todayChores.map((e) => e.chore.id)).toEqual(['daily']);
    expect(weekChores.map((e) => e.chore.id)).toEqual(
      expect.arrayContaining(['wed', 'fri'])
    );
    expect(weekChores.map((e) => e.chore.id)).not.toContain('monthly');
    expect(weekChores.map((e) => e.chore.id)).not.toContain('daily');
  });

  it('isDone is independent per chore', () => {
    const chores = [
      makeChore({ id: 'c1', recurrence: 'DAILY' }),
      makeChore({ id: 'c2', recurrence: 'DAILY' }),
    ];
    const assignments = chores.map((c) => makeAssignment(c.id));
    // Only c1 is completed today.
    const completions = [makeCompletion('c1', '2024-03-18T08:00:00')];

    const { todayChores } = buildKidChoresBuckets(chores, assignments, completions, USER, MON);
    const c1 = todayChores.find((e) => e.chore.id === 'c1')!;
    const c2 = todayChores.find((e) => e.chore.id === 'c2')!;
    expect(c1.isDone).toBe(true);
    expect(c2.isDone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildKidChoresBuckets – edge cases', () => {
  it('handles empty chores/assignments/completions without throwing', () => {
    expect(() =>
      buildKidChoresBuckets([], [], [], USER, MON)
    ).not.toThrow();
  });

  it('handles a chore assigned multiple times to the same user (deduplication via chore list)', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'DAILY' })];
    // Two assignment records pointing to the same chore for the same user.
    const assignments = [makeAssignment('c1'), makeAssignment('c1')];
    const { todayChores } = buildKidChoresBuckets(chores, assignments, [], USER, MON);
    // Chore list has one entry, so bucket should have one entry.
    expect(todayChores).toHaveLength(1);
  });

  it('returns correct bucket when today is Sunday', () => {
    // Sunday is the last day of the ISO week (day 7).
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['SUN'] })];
    const { todayChores, weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      SUN
    );
    expect(todayChores).toHaveLength(1);
    expect(weekChores).toHaveLength(0);
  });

  it('returns correct bucket when today is Friday and chore is on Saturday', () => {
    const chores = [makeChore({ id: 'c1', recurrence: 'WEEKLY', daysOfWeek: ['SAT'] })];
    const { todayChores, weekChores } = buildKidChoresBuckets(
      chores,
      [makeAssignment('c1')],
      [],
      USER,
      FRI
    );
    expect(todayChores).toHaveLength(0);
    expect(weekChores).toHaveLength(1);
  });
});
