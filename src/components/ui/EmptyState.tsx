import type { ReactNode } from 'react';

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && <p className="max-w-[36ch] text-[14px] text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
