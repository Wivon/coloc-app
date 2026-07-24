import 'server-only';

import { db, unwrap } from '@/lib/db/client';
import { addDays, today } from '@/lib/date';
import type { ChoreAssignmentRow, ChoreRow, IsoDate, Uuid } from '@/lib/db/types';
import { listMembers, type Member } from './households';
import { planAssignments } from './schedule-math';

/** Horizon de planification par défaut, en jours. */
export const SCHEDULE_HORIZON_DAYS = 21;

/** Fenêtre glissante utilisée pour mesurer la charge de chacun. */
const WORKLOAD_WINDOW_DAYS = 30;

export interface AgendaItem {
  id: Uuid;
  choreId: Uuid;
  title: string;
  emoji: string;
  effort: number;
  dueOn: IsoDate;
  assigneeId: Uuid;
  completedAt: string | null;
}

export interface WorkloadEntry {
  member: Member;
  /** Effort des tâches terminées sur la fenêtre glissante. */
  done: number;
  /** Effort des tâches encore à faire (planifiées ou en retard). */
  pending: number;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listChores(householdId: Uuid): Promise<ChoreRow[]> {
  return unwrap(
    await db()
      .from('chores')
      .select('*')
      .eq('household_id', householdId)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
  );
}

export async function listAgenda(
  householdId: Uuid,
  range: { from: IsoDate; to: IsoDate },
): Promise<AgendaItem[]> {
  const rows = unwrap(
    await db()
      .from('chore_assignments')
      .select('id, chore_id, due_on, assignee_id, completed_at, chores(title, emoji, effort)')
      .eq('household_id', householdId)
      .gte('due_on', range.from)
      .lte('due_on', range.to)
      .order('due_on', { ascending: true })
      .returns<
        (Pick<ChoreAssignmentRow, 'id' | 'chore_id' | 'due_on' | 'assignee_id' | 'completed_at'> & {
          chores: Pick<ChoreRow, 'title' | 'emoji' | 'effort'>;
        })[]
      >(),
  );

  return rows.map((row) => ({
    id: row.id,
    choreId: row.chore_id,
    title: row.chores.title,
    emoji: row.chores.emoji,
    effort: row.chores.effort,
    dueOn: row.due_on,
    assigneeId: row.assignee_id,
    completedAt: row.completed_at,
  }));
}

/** Répartition de la charge sur la fenêtre glissante, pour la vue « équilibre ». */
export async function getWorkload(householdId: Uuid): Promise<WorkloadEntry[]> {
  const members = await listMembers(householdId);
  const items = await listAgenda(householdId, {
    from: addDays(today(), -WORKLOAD_WINDOW_DAYS),
    to: addDays(today(), SCHEDULE_HORIZON_DAYS),
  });

  const byMember = new Map(members.map((m) => [m.id, { member: m, done: 0, pending: 0 }]));
  for (const item of items) {
    const entry = byMember.get(item.assigneeId);
    if (!entry) continue;
    if (item.completedAt) entry.done += item.effort;
    else entry.pending += item.effort;
  }

  return [...byMember.values()];
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export async function createChore(
  householdId: Uuid,
  input: { title: string; emoji: string; effort: number; frequencyDays: number },
): Promise<ChoreRow> {
  const chore = unwrap(
    await db()
      .from('chores')
      .insert({
        household_id: householdId,
        title: input.title,
        emoji: input.emoji,
        effort: input.effort,
        frequency_days: input.frequencyDays,
        starts_on: today(),
      })
      .select()
      .single(),
  );

  await generateSchedule(householdId);
  return chore;
}

export async function archiveChore(householdId: Uuid, choreId: Uuid): Promise<void> {
  await db()
    .from('chores')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', choreId)
    .eq('household_id', householdId);

  // On retire les échéances futures non faites : l'historique reste intact.
  await db()
    .from('chore_assignments')
    .delete()
    .eq('chore_id', choreId)
    .is('completed_at', null)
    .gte('due_on', today());
}

export async function setAssignmentDone(
  householdId: Uuid,
  assignmentId: Uuid,
  userId: Uuid,
  done: boolean,
): Promise<void> {
  await db()
    .from('chore_assignments')
    .update(
      done
        ? { completed_at: new Date().toISOString(), completed_by: userId }
        : { completed_at: null, completed_by: null },
    )
    .eq('id', assignmentId)
    .eq('household_id', householdId);
}

/** Réattribue manuellement une échéance à un autre coloc. */
export async function reassign(
  householdId: Uuid,
  assignmentId: Uuid,
  assigneeId: Uuid,
): Promise<void> {
  await assertMemberOfHousehold(householdId, assigneeId);
  await db()
    .from('chore_assignments')
    .update({ assignee_id: assigneeId })
    .eq('id', assignmentId)
    .eq('household_id', householdId);
}

/** Efface les échéances futures non faites puis relance la répartition à zéro. */
export async function rebalanceSchedule(householdId: Uuid): Promise<number> {
  await db()
    .from('chore_assignments')
    .delete()
    .eq('household_id', householdId)
    .is('completed_at', null)
    .gte('due_on', today());

  return generateSchedule(householdId);
}

// ---------------------------------------------------------------------------
// Répartition automatique
// ---------------------------------------------------------------------------

/**
 * Crée les échéances manquantes sur l'horizon et les attribue automatiquement.
 *
 * Pour chaque tâche on déroule sa cadence (`frequency_days`) depuis `starts_on`
 * et on ne garde que les dates à venir qui n'ont pas déjà une attribution.
 * Les créneaux obtenus sont traités par ordre chronologique et chacun revient au
 * coloc dont la charge cumulée est la plus faible — charge mesurée en « effort »
 * sur une fenêtre glissante, historique et planifié confondus.
 *
 * Départages successifs : celui qui a fait cette tâche-là le moins récemment,
 * puis l'ordre d'arrivée dans la coloc. Le résultat est donc déterministe, et la
 * rotation s'installe naturellement sans avoir à mémoriser un « tour ».
 *
 * La fonction est idempotente : la relancer ne crée aucun doublon.
 */
export async function generateSchedule(
  householdId: Uuid,
  horizonDays = SCHEDULE_HORIZON_DAYS,
): Promise<number> {
  const [members, chores] = await Promise.all([listMembers(householdId), listChores(householdId)]);
  if (members.length === 0 || chores.length === 0) return 0;

  const start = today();

  const existing = unwrap(
    await db()
      .from('chore_assignments')
      .select('chore_id, assignee_id, due_on, chores(effort)')
      .eq('household_id', householdId)
      .gte('due_on', addDays(start, -WORKLOAD_WINDOW_DAYS))
      .returns<
        (Pick<ChoreAssignmentRow, 'chore_id' | 'assignee_id' | 'due_on'> & {
          chores: Pick<ChoreRow, 'effort'>;
        })[]
      >(),
  );

  const planned = planAssignments({
    memberIds: members.map((member) => member.id),
    chores: chores.map((chore) => ({
      id: chore.id,
      title: chore.title,
      effort: chore.effort,
      frequencyDays: chore.frequency_days,
      startsOn: chore.starts_on,
    })),
    existing: existing.map((row) => ({
      choreId: row.chore_id,
      assigneeId: row.assignee_id,
      dueOn: row.due_on,
      effort: row.chores.effort,
    })),
    from: start,
    to: addDays(start, horizonDays),
  });

  if (planned.length === 0) return 0;

  // `ignoreDuplicates` protège d'une génération concurrente (deux colocs qui
  // ouvrent l'app en même temps) grâce à l'unicité (chore_id, due_on).
  await db()
    .from('chore_assignments')
    .upsert(
      planned.map((assignment) => ({
        chore_id: assignment.choreId,
        household_id: householdId,
        assignee_id: assignment.assigneeId,
        due_on: assignment.dueOn,
      })),
      { onConflict: 'chore_id,due_on', ignoreDuplicates: true },
    );

  return planned.length;
}

async function assertMemberOfHousehold(householdId: Uuid, userId: Uuid): Promise<void> {
  const { data } = await db()
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) throw new Error('Ce coloc ne fait pas partie de la colocation.');
}

const pairKey = (choreId: Uuid, userId: Uuid) => `${choreId}:${userId}`;
const slotKey = (choreId: Uuid, dueOn: IsoDate) => `${choreId}@${dueOn}`;
