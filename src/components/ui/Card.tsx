import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Liste de lignes séparées par des filets, sans padding externe. */
export function CardList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('divide-y divide-line rounded-2xl border border-line bg-surface', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">{children}</h2>
      {action}
    </div>
  );
}
