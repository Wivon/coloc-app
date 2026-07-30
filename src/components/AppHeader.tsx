import type { ReactNode } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { requireHouseholdContext } from '@/lib/domain/households';

/**
 * En-tête des pages authentifiées, isolé dans son propre composant asynchrone.
 *
 * Il lit la colocation courante, donc il suspend. En le plaçant sous son propre
 * `<Suspense>`, la page peut rendre sa structure immédiatement : le titre est
 * déjà affiché par `HeaderSkeleton` pendant que le nom de la coloc arrive.
 */
export async function AppHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { household, user } = await requireHouseholdContext();

  return <PageHeader title={title} subtitle={household.name} action={action} user={user} />;
}
