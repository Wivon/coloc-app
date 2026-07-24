'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';

import { reassignChoreAction, toggleChoreAction } from '@/actions/chores';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CardList, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { DeleteChoreButton } from './DeleteChoreButton';
import { TaskRow } from './TaskRow';
import { daysBetween, formatLongDate, today } from '@/lib/date';
import type { AgendaItem } from '@/lib/domain/chores';
import type { Member } from '@/lib/domain/households';

type Filter = 'mine' | 'all';

const GROUPS = [
  { key: 'late', label: 'En retard' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'later', label: 'Plus tard' },
] as const;

export function TasksView({
  items,
  members,
  currentUserId,
}: {
  items: AgendaItem[];
  members: Member[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState<Filter>('mine');
  const [selected, setSelected] = useState<AgendaItem | null>(null);
  const [, startTransition] = useTransition();

  // Le clic sur une case doit être instantané ; le serveur confirme ensuite.
  const [optimisticItems, applyToggle] = useOptimistic(
    items,
    (state: AgendaItem[], update: { id: string; done: boolean }) =>
      state.map((item) =>
        item.id === update.id
          ? { ...item, completedAt: update.done ? new Date().toISOString() : null }
          : item,
      ),
  );

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const visible = useMemo(
    () =>
      filter === 'mine'
        ? optimisticItems.filter((item) => item.assigneeId === currentUserId)
        : optimisticItems,
    [filter, optimisticItems, currentUserId],
  );

  const groups = useMemo(() => groupByDue(visible), [visible]);
  const remaining = visible.filter((item) => !item.completedAt).length;

  function toggle(item: AgendaItem) {
    const done = !item.completedAt;
    startTransition(async () => {
      applyToggle({ id: item.id, done });
      await toggleChoreAction(item.id, done);
    });
  }

  function reassign(item: AgendaItem, assigneeId: string) {
    setSelected(null);
    startTransition(async () => {
      await reassignChoreAction(item.id, assigneeId);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'mine', label: 'Mes tâches' },
          { value: 'all', label: 'La coloc' },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          emoji="🧹"
          title={filter === 'mine' ? 'Rien pour toi' : 'Aucune tâche planifiée'}
          description={
            filter === 'mine'
              ? 'Profites-en. Passe sur « La coloc » pour voir le reste.'
              : 'Ajoutez une tâche récurrente : la répartition entre colocs se fait toute seule.'
          }
        />
      ) : (
        <>
          <p className="-mt-1 px-1 text-[13px] text-muted">
            {remaining === 0
              ? 'Tout est fait sur cette période 🎉'
              : `${remaining} tâche${remaining > 1 ? 's' : ''} à faire`}
          </p>

          {GROUPS.map((group) => {
            const groupItems = groups[group.key];
            if (groupItems.length === 0) return null;

            return (
              <section key={group.key}>
                <SectionTitle>{group.label}</SectionTitle>
                <CardList>
                  {groupItems.map((item) => (
                    <TaskRow
                      key={item.id}
                      item={item}
                      assignee={membersById.get(item.assigneeId)}
                      isMine={item.assigneeId === currentUserId}
                      onToggle={() => toggle(item)}
                      onOpen={() => setSelected(item)}
                    />
                  ))}
                </CardList>
              </section>
            );
          })}
        </>
      )}

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.emoji} ${selected.title}` : ''}
        description={selected ? formatLongDate(selected.dueOn) : undefined}
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">Attribuer à</p>
              <div className="flex flex-col gap-1">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => reassign(selected, member.id)}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-sunken"
                  >
                    <Avatar
                      id={member.id}
                      name={member.displayName}
                      color={member.avatarColor}
                      size="sm"
                    />
                    <span className="flex-1 text-[15px] text-ink">{member.displayName}</span>
                    {member.id === selected.assigneeId && (
                      <span className="text-[13px] font-medium text-accent">Actuel</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                toggle(selected);
                setSelected(null);
              }}
            >
              {selected.completedAt ? 'Marquer comme à faire' : 'Marquer comme faite'}
            </Button>

            <DeleteChoreButton choreId={selected.choreId} onDeleted={() => setSelected(null)} />
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Répartit les échéances en « en retard / aujourd'hui / cette semaine / plus tard ». */
function groupByDue(items: AgendaItem[]): Record<(typeof GROUPS)[number]['key'], AgendaItem[]> {
  const reference = today();
  const groups = { late: [], today: [], week: [], later: [] } as Record<
    (typeof GROUPS)[number]['key'],
    AgendaItem[]
  >;

  for (const item of items) {
    const delta = daysBetween(reference, item.dueOn);
    if (delta < 0) groups.late.push(item);
    else if (delta === 0) groups.today.push(item);
    else if (delta <= 7) groups.week.push(item);
    else groups.later.push(item);
  }

  return groups;
}
