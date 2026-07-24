import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planAssignments, upcomingDueDates, type SchedulableChore } from '@/lib/domain/schedule-math';

const members = ['ana', 'bob', 'cleo'];

function chore(overrides: Partial<SchedulableChore> = {}): SchedulableChore {
  return {
    id: 'vaisselle',
    title: 'Vaisselle',
    effort: 1,
    frequencyDays: 1,
    startsOn: '2026-01-01',
    ...overrides,
  };
}

test('upcomingDueDates démarre à la première échéance >= from', () => {
  const dates = upcomingDueDates(
    chore({ frequencyDays: 7, startsOn: '2026-01-01' }),
    '2026-01-10',
    '2026-01-31',
  );

  // La cadence reste calée sur startsOn : 01, 08, 15, 22, 29.
  assert.deepEqual(dates, ['2026-01-15', '2026-01-22', '2026-01-29']);
});

test("upcomingDueDates ne remonte jamais avant la date de début", () => {
  const dates = upcomingDueDates(chore({ startsOn: '2026-03-01' }), '2026-01-01', '2026-03-03');
  assert.deepEqual(dates, ['2026-03-01', '2026-03-02', '2026-03-03']);
});

test('la charge se répartit équitablement entre colocs', () => {
  const planned = planAssignments({
    memberIds: members,
    chores: [chore()],
    existing: [],
    from: '2026-01-01',
    to: '2026-01-09',
  });

  assert.equal(planned.length, 9);

  const counts = new Map(members.map((id) => [id, 0]));
  for (const assignment of planned) {
    counts.set(assignment.assigneeId, (counts.get(assignment.assigneeId) ?? 0) + 1);
  }
  assert.deepEqual([...counts.values()], [3, 3, 3]);
});

test('les tâches lourdes comptent double dans la répartition', () => {
  const planned = planAssignments({
    memberIds: ['ana', 'bob'],
    chores: [
      chore({ id: 'sols', title: 'Sols', effort: 3, frequencyDays: 7 }),
      chore({ id: 'poubelles', title: 'Poubelles', effort: 1, frequencyDays: 7 }),
    ],
    existing: [],
    from: '2026-01-01',
    to: '2026-01-08',
  });

  // Deux semaines de chaque tâche : la lourde alterne, la légère compense.
  const load = { ana: 0, bob: 0 } as Record<string, number>;
  for (const assignment of planned) {
    load[assignment.assigneeId] += assignment.choreId === 'sols' ? 3 : 1;
  }
  assert.equal(load.ana, load.bob);
});

test('la charge déjà accumulée est rattrapée', () => {
  const planned = planAssignments({
    memberIds: ['ana', 'bob'],
    chores: [chore({ frequencyDays: 1 })],
    // Ana a déjà fait quatre fois la tâche.
    existing: [1, 2, 3, 4].map((day) => ({
      choreId: 'vaisselle',
      assigneeId: 'ana',
      dueOn: `2025-12-0${day}`,
      effort: 1,
    })),
    from: '2026-01-01',
    to: '2026-01-04',
  });

  assert.deepEqual(
    planned.map((assignment) => assignment.assigneeId),
    ['bob', 'bob', 'bob', 'bob'],
  );
});

test('les échéances déjà attribuées ne sont jamais dupliquées', () => {
  const existing = [
    { choreId: 'vaisselle', assigneeId: 'cleo', dueOn: '2026-01-02', effort: 1 },
  ];
  const planned = planAssignments({
    memberIds: members,
    chores: [chore()],
    existing,
    from: '2026-01-01',
    to: '2026-01-03',
  });

  assert.deepEqual(
    planned.map((assignment) => assignment.dueOn),
    ['2026-01-01', '2026-01-03'],
  );
});

test('le résultat est déterministe', () => {
  const input = {
    memberIds: members,
    chores: [chore(), chore({ id: 'sols', title: 'Sols', effort: 2, frequencyDays: 3 })],
    existing: [],
    from: '2026-01-01',
    to: '2026-01-15',
  };

  assert.deepEqual(planAssignments(input), planAssignments(input));
});

test('sans coloc ou sans tâche, rien n’est planifié', () => {
  const base = { existing: [], from: '2026-01-01', to: '2026-01-10' };
  assert.deepEqual(planAssignments({ ...base, memberIds: [], chores: [chore()] }), []);
  assert.deepEqual(planAssignments({ ...base, memberIds: members, chores: [] }), []);
});
