import { cn } from '@/lib/cn';

/**
 * Blocs de remplacement affichés pendant le chargement des données.
 *
 * Ils reprennent les dimensions exactes des composants réels (hauteurs de ligne,
 * rayons, espacements) pour que l'arrivée du contenu ne déplace rien.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn('animate-pulse rounded-md bg-sunken', className)} style={style} />;
}

/** En-tête de page : le titre est déjà connu, seul le sous-titre est en attente. */
export function HeaderSkeleton({ title }: { title: string }) {
  return (
    <header className="safe-top sticky top-0 z-30 -mx-4 mb-4 border-b border-line/70 bg-bg/85 px-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h1>
          <Skeleton className="mt-1.5 h-3 w-24" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
    </header>
  );
}

/** Liste de lignes, calquée sur `CardList`. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5" style={{ width: `${55 + ((index * 13) % 30)}%` }} />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </div>
          <Skeleton className="h-3.5 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Grande carte de synthèse (total du mois, solde…). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-4', className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2.5 h-8 w-32" />
    </div>
  );
}

export function SectionTitleSkeleton() {
  return <Skeleton className="mb-2 ml-1 h-3 w-28" />;
}
