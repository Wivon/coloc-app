'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { requireHouseholdContext } from '@/lib/domain/households';
import {
  archiveChore,
  createChore,
  generateSchedule,
  reassign,
  rebalanceSchedule,
  setAssignmentDone,
} from '@/lib/domain/chores';
import { notifyInBackground } from '@/lib/domain/push';

export async function addChoreAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();

    const title = String(formData.get('title') ?? '').trim();
    if (title.length < 2) throw new Error('Donnez un nom à la tâche.');

    await createChore(household.id, {
      title,
      emoji: String(formData.get('emoji') ?? '🧽'),
      effort: clamp(Number(formData.get('effort') ?? 1), 1, 5),
      frequencyDays: clamp(Number(formData.get('frequencyDays') ?? 7), 1, 90),
    });

    revalidatePath('/tasks');
  });
}

export async function toggleChoreAction(
  assignmentId: string,
  done: boolean,
): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user } = await requireHouseholdContext();
    await setAssignmentDone(household.id, assignmentId, user.id, done);
    revalidatePath('/tasks');
  });
}

export async function reassignChoreAction(
  assignmentId: string,
  assigneeId: string,
): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user } = await requireHouseholdContext();
    await reassign(household.id, assignmentId, assigneeId);

    if (assigneeId !== user.id) {
      notifyInBackground([assigneeId], {
        title: 'Nouvelle tâche pour toi',
        body: `${user.display_name} t’a confié une tâche.`,
        url: '/tasks',
        tag: 'chore-reassign',
      });
    }

    revalidatePath('/tasks');
  });
}

export async function deleteChoreAction(choreId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    await archiveChore(household.id, choreId);
    revalidatePath('/tasks');
  });
}

/** Relance une répartition complète des échéances à venir. */
export async function rebalanceAction(): Promise<ActionResult<number>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    const created = await rebalanceSchedule(household.id);
    revalidatePath('/tasks');
    return created;
  });
}

/** Complète le planning sans toucher aux attributions existantes. */
export async function fillScheduleAction(): Promise<ActionResult<number>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    const created = await generateSchedule(household.id);
    if (created > 0) revalidatePath('/tasks');
    return created;
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
