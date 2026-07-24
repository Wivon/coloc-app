import { addDays, daysBetween } from '@/lib/date';
import type { IsoDate, Uuid } from '@/lib/db/types';

/**
 * Répartition automatique des tâches — logique pure, sans accès base.
 *
 * Séparée de `chores.ts` pour être testable et relisible indépendamment des
 * requêtes SQL.
 */

export interface SchedulableChore {
  id: Uuid;
  title: string;
  effort: number;
  frequencyDays: number;
  startsOn: IsoDate;
}

export interface ExistingAssignment {
  choreId: Uuid;
  assigneeId: Uuid;
  dueOn: IsoDate;
  effort: number;
}

export interface PlannedAssignment {
  choreId: Uuid;
  assigneeId: Uuid;
  dueOn: IsoDate;
}

/**
 * Calcule les échéances manquantes sur [from, to] et les attribue.
 *
 * Pour chaque tâche on déroule sa cadence depuis `startsOn` et on ne garde que
 * les dates sans attribution existante. Les créneaux sont traités par ordre
 * chronologique (les plus lourds d'abord à date égale), et chacun revient au
 * coloc dont la charge cumulée est la plus faible — charge mesurée en
 * « effort », historique et planifié confondus.
 *
 * Départages successifs : celui qui a fait cette tâche-là le moins récemment,
 * puis l'ordre d'arrivée dans la coloc. Le résultat est déterministe et la
 * rotation s'installe d'elle-même, sans mémoriser de « tour ».
 */
export function planAssignments(input: {
  memberIds: Uuid[];
  chores: SchedulableChore[];
  existing: ExistingAssignment[];
  from: IsoDate;
  to: IsoDate;
}): PlannedAssignment[] {
  const { memberIds, chores, existing, from, to } = input;
  if (memberIds.length === 0 || chores.length === 0) return [];

  const load = new Map<Uuid, number>(memberIds.map((id) => [id, 0]));
  const lastAssigned = new Map<string, IsoDate>();
  const taken = new Set<string>();

  for (const assignment of existing) {
    load.set(assignment.assigneeId, (load.get(assignment.assigneeId) ?? 0) + assignment.effort);
    lastAssigned.set(pairKey(assignment.choreId, assignment.assigneeId), assignment.dueOn);
    taken.add(slotKey(assignment.choreId, assignment.dueOn));
  }

  const slots = chores
    .flatMap((chore) =>
      upcomingDueDates(chore, from, to)
        .filter((dueOn) => !taken.has(slotKey(chore.id, dueOn)))
        .map((dueOn) => ({ chore, dueOn })),
    )
    .sort(
      (a, b) =>
        a.dueOn.localeCompare(b.dueOn) ||
        // À date égale, les tâches lourdes d'abord : placer les gros blocs en
        // premier laisse les petits combler les écarts (heuristique LPT), ce
        // qui équilibre nettement mieux qu'un simple ordre alphabétique.
        b.chore.effort - a.chore.effort ||
        a.chore.title.localeCompare(b.chore.title),
    );

  return slots.map(({ chore, dueOn }) => {
    const assigneeId = pickAssignee(memberIds, chore.id, load, lastAssigned);
    load.set(assigneeId, (load.get(assigneeId) ?? 0) + chore.effort);
    lastAssigned.set(pairKey(chore.id, assigneeId), dueOn);
    return { choreId: chore.id, assigneeId, dueOn };
  });
}

/** Échéances de la tâche comprises dans [from, to], alignées sur sa cadence. */
export function upcomingDueDates(
  chore: SchedulableChore,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  const elapsed = daysBetween(chore.startsOn, from);
  const cyclesToSkip = Math.max(0, Math.ceil(elapsed / chore.frequencyDays));

  const dates: IsoDate[] = [];
  let due = addDays(chore.startsOn, cyclesToSkip * chore.frequencyDays);
  while (due <= to) {
    dates.push(due);
    due = addDays(due, chore.frequencyDays);
  }
  return dates;
}

function pickAssignee(
  memberIds: Uuid[],
  choreId: Uuid,
  load: Map<Uuid, number>,
  lastAssigned: Map<string, IsoDate>,
): Uuid {
  return memberIds.reduce((best, candidate) => {
    const delta = (load.get(candidate) ?? 0) - (load.get(best) ?? 0);
    if (delta !== 0) return delta < 0 ? candidate : best;

    // '' = n'a jamais eu cette tâche, donc prioritaire.
    const candidateLast = lastAssigned.get(pairKey(choreId, candidate)) ?? '';
    const bestLast = lastAssigned.get(pairKey(choreId, best)) ?? '';
    return candidateLast < bestLast ? candidate : best;
  });
}

const pairKey = (choreId: Uuid, userId: Uuid) => `${choreId}:${userId}`;
const slotKey = (choreId: Uuid, dueOn: IsoDate) => `${choreId}@${dueOn}`;
