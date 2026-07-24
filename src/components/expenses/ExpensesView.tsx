'use client';

import { useMemo, useState, useTransition } from 'react';

import { deleteExpenseAction } from '@/actions/expenses';
import { Amount } from '@/components/ui/Amount';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CardList, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { category } from '@/lib/categories';
import { formatLongDate, formatMonthLabel, formatShortDate, monthKey } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { Expense } from '@/lib/domain/expenses';
import type { Member } from '@/lib/domain/households';

export function ExpensesView({
  expenses,
  members,
  currentUserId,
  currency,
}: {
  expenses: Expense[];
  members: Member[];
  currentUserId: string;
  currency: string;
}) {
  const [selected, setSelected] = useState<Expense | null>(null);
  const [pending, startTransition] = useTransition();

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const months = useMemo(() => groupByMonth(expenses), [expenses]);

  if (expenses.length === 0) {
    return (
      <EmptyState
        emoji="🧾"
        title="Aucune dépense"
        description="Ajoutez la première : elle sera partagée avec toute la coloc par défaut."
      />
    );
  }

  const nameOf = (id: string) =>
    id === currentUserId ? 'Moi' : (membersById.get(id)?.displayName ?? 'Ancien coloc');

  return (
    <div className="flex flex-col gap-6">
      {months.map(([month, monthExpenses]) => (
        <section key={month}>
          <SectionTitle
            action={
              <span className="text-[13px] tabular text-muted">
                {formatMoney(sum(monthExpenses), currency, { compact: true })}
              </span>
            }
          >
            {formatMonthLabel(month)}
          </SectionTitle>

          <CardList>
            {monthExpenses.map((expense) => {
              const myShare = expense.shares.find((share) => share.userId === currentUserId);
              const participants = expense.shares
                .map((share) => membersById.get(share.userId))
                .filter((member): member is Member => Boolean(member));

              return (
                <button
                  key={expense.id}
                  type="button"
                  onClick={() => setSelected(expense)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-sunken"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-[16px]">
                    <span aria-hidden>{category(expense.category).emoji}</span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">
                      {expense.description}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-subtle">
                      <span className="truncate">
                        {nameOf(expense.payerId)} · {formatShortDate(expense.spentOn)}
                      </span>
                      <AvatarStack people={participants} max={3} />
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <Amount cents={expense.amountCents} currency={currency} className="text-[15px]" />
                    <span className="block text-[12.5px] text-subtle tabular">
                      {myShare
                        ? `ma part ${formatMoney(myShare.amountCents, currency)}`
                        : 'pas concerné'}
                    </span>
                  </span>
                </button>
              );
            })}
          </CardList>
        </section>
      ))}

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.description ?? ''}
        description={selected ? formatLongDate(selected.spentOn) : undefined}
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <Amount
                cents={selected.amountCents}
                currency={currency}
                className="text-[32px] font-semibold"
              />
              <p className="mt-1 text-[13px] text-muted">
                avancé par {nameOf(selected.payerId)} · {category(selected.category).label}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">Répartition</p>
              <ul className="flex flex-col gap-1">
                {selected.shares.map((share) => {
                  const member = membersById.get(share.userId);
                  return (
                    <li
                      key={share.userId}
                      className="flex items-center gap-3 rounded-xl px-2 py-1.5"
                    >
                      <Avatar
                        id={share.userId}
                        name={member?.displayName ?? '?'}
                        color={member?.avatarColor}
                        size="sm"
                      />
                      <span className="flex-1 text-[15px] text-ink">
                        {member?.displayName ?? 'Ancien coloc'}
                      </span>
                      <Amount cents={share.amountCents} currency={currency} tone="muted" />
                    </li>
                  );
                })}
              </ul>
            </div>

            <Button
              variant="danger"
              size="lg"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteExpenseAction(selected.id);
                  setSelected(null);
                })
              }
            >
              {pending ? 'Suppression…' : 'Supprimer la dépense'}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Les dépenses arrivent déjà triées par date décroissante. */
function groupByMonth(expenses: Expense[]): [string, Expense[]][] {
  const months = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const key = monthKey(expense.spentOn);
    const bucket = months.get(key);
    if (bucket) bucket.push(expense);
    else months.set(key, [expense]);
  }
  return [...months.entries()];
}

const sum = (expenses: Expense[]) =>
  expenses.reduce((total, expense) => total + expense.amountCents, 0);
