import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { MonthNav } from '@/components/insights/MonthNav';
import { TrendChart } from '@/components/insights/TrendChart';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardList, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InsightsContentSkeleton } from '@/components/PageSkeletons';
import { HeaderSkeleton } from '@/components/ui/Skeleton';
import { category } from '@/lib/categories';
import { formatShortDate, monthKey, today } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getInsights } from '@/lib/domain/insights';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Insights' };

export default async function InsightsPage(props: PageProps<'/insights'>) {
  const searchParams = await props.searchParams;
  const month = normalizeMonth(searchParams.m);

  return (
    <>
      <Suspense fallback={<HeaderSkeleton title="Insights" />}>
        <AppHeader title="Insights" />
      </Suspense>

      {/* La clé remonte le squelette à chaque changement de mois, plutôt que de
          laisser l'ancien mois affiché pendant le chargement du nouveau. */}
      <Suspense key={month} fallback={<InsightsContentSkeleton />}>
        <InsightsContent month={month} />
      </Suspense>
    </>
  );
}

async function InsightsContent({ month }: { month: string }) {
  const { household, user, members } = await requireHouseholdContext();
  const insights = await getInsights(
    household.id,
    members.map((member) => member.id),
    month,
  );

  const currency = household.currency;
  const membersById = new Map(members.map((member) => [member.id, member]));

  // Même somme que « Ma part » sur l'écran Dépenses — le total des parts de
  // l'utilisateur — mais sur le mois affiché ici, pas forcément le mois courant.
  const myShareCents =
    insights.byMember.find((entry) => entry.userId === user.id)?.shareCents ?? 0;

  return (
    <>
      <div className="flex flex-col gap-6">
        <Card>
          <MonthNav month={month} />

          <div className="mt-4 text-center">
            <Amount
              cents={insights.totalCents}
              currency={currency}
              className="text-[34px] font-semibold tracking-[-0.02em]"
            />
            <p className="mt-1 text-[13px] text-muted">
              {insights.changeRatio === null ? (
                'Dépenses de la colocation'
              ) : (
                <>
                  <span
                    className={insights.changeRatio > 0 ? 'text-negative' : 'text-positive'}
                  >
                    {insights.changeRatio > 0 ? '↑' : '↓'}{' '}
                    {Math.abs(Math.round(insights.changeRatio * 100))} %
                  </span>{' '}
                  vs mois précédent ({formatMoney(insights.previousTotalCents, currency, {
                    compact: true,
                  })})
                </>
              )}
            </p>
          </div>

          <div className="mt-5">
            <TrendChart data={insights.trend} currency={currency} activeMonth={month} />
          </div>
        </Card>

        {insights.expenseCount === 0 ? (
          <EmptyState
            emoji="📊"
            title="Rien à analyser"
            description="Aucune dépense enregistrée sur ce mois."
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Dépenses" value={String(insights.expenseCount)} />
              <Stat
                label="Ma part"
                value={formatMoney(myShareCents, currency, { compact: true })}
              />
              <Stat
                label="Par jour"
                value={formatMoney(insights.dailyAverageCents, currency, { compact: true })}
              />
            </div>

            <section>
              <SectionTitle>Par catégorie</SectionTitle>
              <Card>
                <ul className="flex flex-col gap-3">
                  {insights.byCategory.map((slice) => {
                    const meta = category(slice.id);
                    return (
                      <li key={slice.id} className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-[15px]">
                          <span aria-hidden>{meta.emoji}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[14.5px] text-ink">{meta.label}</span>
                            <Amount
                              cents={slice.amountCents}
                              currency={currency}
                              className="text-[14px]"
                            />
                          </span>
                          <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-sunken">
                            <span
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.max(2, slice.ratio * 100)}%` }}
                            />
                          </span>
                        </span>
                        <span className="w-9 shrink-0 text-right text-[12.5px] tabular text-subtle">
                          {Math.round(slice.ratio * 100)} %
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>

            <section>
              <SectionTitle>Par coloc</SectionTitle>
              <CardList>
                {insights.byMember.map((entry) => {
                  const member = membersById.get(entry.userId);
                  const delta = entry.paidCents - entry.shareCents;

                  return (
                    <div key={entry.userId} className="flex items-center gap-3 px-4 py-3">
                      <Avatar
                        id={entry.userId}
                        name={member?.displayName ?? '?'}
                        color={member?.avatarColor}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">
                          {member?.displayName ?? 'Ancien coloc'}
                        </span>
                        <span className="block text-[12.5px] text-subtle tabular">
                          a avancé {formatMoney(entry.paidCents, currency, { compact: true })}
                        </span>
                      </span>
                      <span className="text-right">
                        <Amount cents={entry.shareCents} currency={currency} className="text-[15px]" />
                        <span className="block text-[12px] tabular text-subtle">
                          {delta === 0
                            ? 'à l’équilibre'
                            : delta > 0
                              ? `+${formatMoney(delta, currency, { compact: true })} avancé`
                              : `${formatMoney(-delta, currency, { compact: true })} à charge`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </CardList>
            </section>

            <section>
              <SectionTitle>Plus grosses dépenses</SectionTitle>
              <CardList>
                {insights.topExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[16px]" aria-hidden>
                      {category(expense.category).emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] text-ink">
                        {expense.description}
                      </span>
                      <span className="block text-[12.5px] text-subtle">
                        {membersById.get(expense.payerId)?.displayName ?? 'Ancien coloc'} ·{' '}
                        {formatShortDate(expense.spentOn)}
                      </span>
                    </span>
                    <Amount cents={expense.amountCents} currency={currency} />
                  </div>
                ))}
              </CardList>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3 text-center">
      <p className="text-[17px] font-semibold tabular text-ink">{value}</p>
      <p className="mt-0.5 text-[12px] text-subtle">{label}</p>
    </div>
  );
}


/** N'accepte qu'un 'YYYY-MM' passé ou courant. */
function normalizeMonth(value: string | string[] | undefined): string {
  const current = monthKey(today());
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return current;
  return value > current ? current : value;
}
