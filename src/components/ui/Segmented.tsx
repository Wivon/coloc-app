'use client';

import { cn } from '@/lib/cn';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-full bg-sunken p-0.5', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition',
            option.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
