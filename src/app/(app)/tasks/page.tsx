import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { AddChoreButton } from '@/components/tasks/AddChoreButton';
import { TasksView } from '@/components/tasks/TasksView';
import { WorkloadCard } from '@/components/tasks/WorkloadCard';
import { TasksContentSkeleton } from '@/components/PageSkeletons';
import { HeaderSkeleton } from '@/components/ui/Skeleton';
import { addDays, today } from '@/lib/date';
import {
  generateSchedule,
  getWorkload,
  listAgenda,
  SCHEDULE_HORIZON_DAYS,
} from '@/lib/domain/chores';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Tâches' };

/**
 * La page est synchrone : elle rend sa structure immédiatement et laisse
 * l'en-tête et la liste arriver indépendamment sous leurs `Suspense`. C'est ce
 * qui rend le changement d'onglet instantané.
 */
export default function TasksPage() {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton title="Tâches" />}>
        <AppHeader title="Tâches" action={<AddChoreButton />} />
      </Suspense>

      <Suspense fallback={<TasksContentSkeleton />}>
        <TasksContent />
      </Suspense>
    </>
  );
}

async function TasksContent() {
  const { household, user, members } = await requireHouseholdContext();

  // Complète l'horizon de planification. Idempotent : n'écrit que s'il manque
  // des échéances. Placé sous le `Suspense`, il ne retarde plus l'affichage.
  await generateSchedule(household.id);

  const [items, workload] = await Promise.all([
    listAgenda(household.id, {
      from: addDays(today(), -14),
      to: addDays(today(), SCHEDULE_HORIZON_DAYS),
    }),
    getWorkload(household.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <TasksView items={items} members={members} currentUserId={user.id} />
      {items.length > 0 ? <WorkloadCard workload={workload} /> : null}
    </div>
  );
}

