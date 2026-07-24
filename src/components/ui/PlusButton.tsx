import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** Bouton « + » circulaire des en-têtes de page. */
export function PlusButton({
  label,
  className,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={cn(
        'grid size-9 place-items-center rounded-full bg-accent text-accent-fg transition active:scale-95',
        className,
      )}
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
      </svg>
    </button>
  );
}
