import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** Puce sélectionnable (catégorie, participant, filtre). */
export function Chip({
  selected = false,
  className,
  ...props
}: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[14px] transition',
        selected
          ? 'border-accent bg-accent-soft font-medium text-accent'
          : 'border-line bg-surface text-muted hover:border-line-strong',
        className,
      )}
    />
  );
}

/** Étiquette non interactive. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 text-[12px] text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
