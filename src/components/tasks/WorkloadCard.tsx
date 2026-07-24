import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { RebalanceButton } from './RebalanceButton';
import type { WorkloadEntry } from '@/lib/domain/chores';

/**
 * Vue d'ensemble de la charge : part déjà faite (pleine) et part restante
 * (translucide), sur les 30 derniers jours et les 3 semaines à venir.
 */
export function WorkloadCard({ workload }: { workload: WorkloadEntry[] }) {
  const max = Math.max(1, ...workload.map((entry) => entry.done + entry.pending));

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Équilibre</h2>
          <p className="text-[12.5px] text-subtle">30 derniers jours et à venir</p>
        </div>
        <RebalanceButton />
      </div>

      <ul className="flex flex-col gap-2.5">
        {workload.map((entry) => {
          const total = entry.done + entry.pending;

          return (
            <li key={entry.member.id} className="flex items-center gap-3">
              <Avatar
                id={entry.member.id}
                name={entry.member.displayName}
                color={entry.member.avatarColor}
                size="xs"
              />
              <span className="w-20 shrink-0 truncate text-[13px] text-muted">
                {entry.member.displayName}
              </span>

              <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                <span
                  className="h-full bg-accent transition-[width]"
                  style={{ width: `${(entry.done / max) * 100}%` }}
                />
                <span
                  className="h-full bg-accent/25 transition-[width]"
                  style={{ width: `${(entry.pending / max) * 100}%` }}
                />
              </span>

              <span className="w-6 shrink-0 text-right text-[13px] tabular text-subtle">
                {total}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
