'use client';

import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { formatDueDate } from '@/lib/date';
import type { AgendaItem } from '@/lib/domain/chores';
import type { Member } from '@/lib/domain/households';

export function TaskRow({
  item,
  assignee,
  isMine,
  onToggle,
  onOpen,
}: {
  item: AgendaItem;
  assignee?: Member;
  isMine: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = Boolean(item.completedAt);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Rouvrir ${item.title}` : `Marquer ${item.title} comme faite`}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border transition',
          done ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong hover:border-accent',
        )}
      >
        {done && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="text-[17px]" aria-hidden>
          {item.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[15px] text-ink transition',
              done && 'text-subtle line-through',
            )}
          >
            {item.title}
          </span>
          <span className="block text-[12.5px] text-subtle">
            {isMine ? 'Pour toi' : (assignee?.displayName ?? 'Non attribuée')} ·{' '}
            {formatDueDate(item.dueOn)}
          </span>
        </span>
      </button>

      {assignee && (
        <Avatar
          id={assignee.id}
          name={assignee.displayName}
          color={assignee.avatarColor}
          size="sm"
          muted={done}
        />
      )}
    </div>
  );
}
