import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { BalancesView } from '@/components/balances/BalancesView';
import { DeleteSettlementButton } from '@/components/balances/DeleteSettlementButton';
import { Amount } from '@/components/ui/Amount';
import { CardList, SectionTitle } from '@/components/ui/Card';
import { BalancesContentSkeleton } from '@/components/PageSkeletons';
import { HeaderSkeleton } from '@/components/ui/Skeleton';
import { formatShortDate } from '@/lib/date';
import { getBalanceSummary, listSettlements } from '@/lib/domain/balances';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Comptes' };

export default function BalancesPage() {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton title="Comptes" />}>
        <AppHeader title="Comptes" />
      </Suspense>

      <Suspense fallback={<BalancesContentSkeleton />}>
        <BalancesContent />
      </Suspense>
    </>
  );
}

async function BalancesContent() {
  const { household, user, members } = await requireHouseholdContext();
  const memberIds = members.map((member) => member.id);

  const [summary, settlements] = await Promise.all([
    getBalanceSummary(household.id, memberIds),
    listSettlements(household.id, 20),
  ]);

  const nameOf = (id: string) =>
    id === user.id
      ? 'Moi'
      : (members.find((member) => member.id === id)?.displayName ?? 'Ancien coloc');

  return (
    <div className="flex flex-col gap-6">
      <BalancesView
        balances={summary.balances}
        transfers={summary.transfers}
        members={members}
        currentUserId={user.id}
        currency={household.currency}
      />

      {settlements.length > 0 ? (
        <section>
          <SectionTitle>Remboursements récents</SectionTitle>
          <CardList>
            {settlements.map((settlement) => (
              <div key={settlement.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">
                    {nameOf(settlement.from_user_id)} → {nameOf(settlement.to_user_id)}
                  </span>
                  <span className="block text-[12.5px] text-subtle">
                    {formatShortDate(settlement.settled_on)}
                    {settlement.note ? ` · ${settlement.note}` : ''}
                  </span>
                </span>
                <Amount
                  cents={settlement.amount_cents}
                  currency={household.currency}
                  tone="muted"
                />
                <DeleteSettlementButton settlementId={settlement.id} />
              </div>
            ))}
          </CardList>
        </section>
      ) : null}
    </div>
  );
}

