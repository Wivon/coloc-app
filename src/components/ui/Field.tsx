import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const control =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-subtle ' +
  'transition focus:border-accent focus:outline-none';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      )}
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-subtle">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cn(control, className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select {...props} className={cn(control, 'appearance-none pr-9', className)}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={cn(control, 'min-h-20 resize-none', className)} />;
}

/** Message d'erreur renvoyé par une Server Action. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-negative/10 px-3.5 py-2.5 text-[14px] text-negative">
      {children}
    </p>
  );
}
