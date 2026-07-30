import {
  CardSkeleton,
  ListSkeleton,
  SectionTitleSkeleton,
  Skeleton,
} from '@/components/ui/Skeleton';

/**
 * Squelettes de contenu, un par onglet.
 *
 * Partagés entre `loading.tsx` (affiché instantanément au clic, depuis le
 * prefetch) et le `<Suspense>` interne de la page (affiché pendant la requête).
 * Les deux montrent donc le même rendu : aucun saut visuel entre les deux
 * étapes.
 */

export function TasksContentSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-9 rounded-full" />
      <div>
        <SectionTitleSkeleton />
        <ListSkeleton rows={3} />
      </div>
      <div>
        <SectionTitleSkeleton />
        <ListSkeleton rows={2} />
      </div>
    </div>
  );
}

export function ExpensesContentSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CardSkeleton />
      <div>
        <SectionTitleSkeleton />
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}

export function BalancesContentSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CardSkeleton className="h-40" />
      <div>
        <SectionTitleSkeleton />
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}

export function InsightsContentSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CardSkeleton className="h-64" />
      <div className="grid grid-cols-3 gap-2">
        <CardSkeleton className="h-[70px]" />
        <CardSkeleton className="h-[70px]" />
        <CardSkeleton className="h-[70px]" />
      </div>
      <div>
        <SectionTitleSkeleton />
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}
