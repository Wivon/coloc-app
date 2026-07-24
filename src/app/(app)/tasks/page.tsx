import type { Metadata } from 'next';

import { PageHeader } from '@/components/PageHeader';
import { AddChoreButton } from '@/components/tasks/AddChoreButton';
import { TasksView } from '@/components/tasks/TasksView';
import { WorkloadCard } from '@/components/tasks/WorkloadCard';
import { addDays, today } from '@/lib/date';
import {
  generateSchedule,
  getWorkload,
  listAgenda,
  SCHEDULE_HORIZON_DAYS,
} from '@/lib/domain/chores';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Tâches' };

export default async function TasksPage() {
  const { household, user, members } = await requireHouseholdContext();

  // Complète l'horizon de planification à l'ouverture de la page. L'opération est
  // idempotente : elle ne touche pas aux échéances déjà attribuées.
  await generateSchedule(household.id);

  const [items, workload] = await Promise.all([
    listAgenda(household.id, {
      from: addDays(today(), -14),
      to: addDays(today(), SCHEDULE_HORIZON_DAYS),
    }),
    getWorkload(household.id),
  ]);

  return (
    <>
      <PageHeader title="Tâches" subtitle={household.name} action={<AddChoreButton />} user={user} />

      <div className="flex flex-col gap-6">
        <TasksView items={items} members={members} currentUserId={user.id} />
        {items.length > 0 && <WorkloadCard workload={workload} />}
      </div>
    </>
  );
}
