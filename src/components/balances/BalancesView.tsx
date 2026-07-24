'use client';

import { useMemo, useState, useTransition } from 'react';

import { settleAllAction, settleTransferAction } from '@/actions/settlements';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardList, SectionTitle } from '@/components/ui/Card';
import { SettleSheet } from './SettleSheet';
import { formatMoney } from '@/lib/money';
import type { Balance, Transfer } from '@/lib/domain/balance-math';
import type { Member } from '@/lib/domain/households';

export function BalancesView({
  balances,
  transfers,
  members,
  currentUserId,
  currency,
}: {
  balances: Balance[];
  transfers: Transfer[];
  members: Member[];
  currentUserId: string;
  currency: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, startTransition] = useTransition();

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const nameOf = (id: string) => membersById.get(id)?.displayName ?? 'Ancien coloc';

  const myNet = balances.find((balance) => balance.userId === currentUserId)?.netCents ?? 0;
  const iOwe = transfers.filter((transfer) => transfer.fromUserId === currentUserId);
  const owedToMe = transfers.filter((transfer) => transfer.toUserId === currentUserId);
  const others = transfers.filter(
    (transfer) => transfer.fromUserId !== currentUserId && transfer.toUserId !== currentUserId,
  );

  function settle(transfer: Transfer) {
    setPendingId(transfer.toUserId);
    startTransition(async () => {
      await settleTransferAction(transfer.toUserId, transfer.amountCents);
      setPendingId(null);
    });
  }

  function settleEverything() {
    setPendingId('all');
    startTransition(async () => {
      await settleAllAction();
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="text-center">
        <p className="text-[13px] text-muted">
          {myNet > 0 ? 'On te doit' : myNet < 0 ? 'Tu dois' : 'Ton solde'}
        </p>
        <p className="mt-1">
          <Amount
            cents={Math.abs(myNet)}
            currency={currency}
            tone={myNet === 0 ? 'muted' : 'balance'}
            className="text-[34px] font-semibold tracking-[-0.02em]"
          />
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {myNet === 0
            ? 'Tout est à jour, rien à régler.'
            : myNet > 0
              ? 'Tes colocs te rembourseront quand ils solderont.'
              : `${iOwe.length} virement${iOwe.length > 1 ? 's' : ''} pour tout remettre à plat.`}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {iOwe.length > 0 && (
            <Button size="lg" disabled={pendingId !== null} onClick={settleEverything}>
              {pendingId === 'all'
                ? 'Enregistrement…'
                : `Tout régler · ${formatMoney(-myNet, currency)}`}
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={() => setSheetOpen(true)}>
            Saisir un remboursement
          </Button>
        </div>
      </Card>

      {iOwe.length > 0 && (
        <section>
          <SectionTitle>À rembourser</SectionTitle>
          <CardList>
            {iOwe.map((transfer) => (
              <TransferRow
                key={`${transfer.fromUserId}-${transfer.toUserId}`}
                label={`À ${nameOf(transfer.toUserId)}`}
                userId={transfer.toUserId}
                name={nameOf(transfer.toUserId)}
                color={membersById.get(transfer.toUserId)?.avatarColor}
                amountCents={transfer.amountCents}
                currency={currency}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => settle(transfer)}
                  >
                    {pendingId === transfer.toUserId ? '…' : 'Payé'}
                  </Button>
                }
              />
            ))}
          </CardList>
        </section>
      )}

      {owedToMe.length > 0 && (
        <section>
          <SectionTitle>On te rembourse</SectionTitle>
          <CardList>
            {owedToMe.map((transfer) => (
              <TransferRow
                key={`${transfer.fromUserId}-${transfer.toUserId}`}
                label={`De ${nameOf(transfer.fromUserId)}`}
                userId={transfer.fromUserId}
                name={nameOf(transfer.fromUserId)}
                color={membersById.get(transfer.fromUserId)?.avatarColor}
                amountCents={transfer.amountCents}
                currency={currency}
              />
            ))}
          </CardList>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <SectionTitle>Entre colocs</SectionTitle>
          <CardList>
            {others.map((transfer) => (
              <div
                key={`${transfer.fromUserId}-${transfer.toUserId}`}
                className="flex items-center gap-3 px-4 py-3 text-[14px] text-muted"
              >
                <span className="flex-1">
                  {nameOf(transfer.fromUserId)} → {nameOf(transfer.toUserId)}
                </span>
                <Amount cents={transfer.amountCents} currency={currency} tone="muted" />
              </div>
            ))}
          </CardList>
        </section>
      )}

      <section>
        <SectionTitle>Soldes</SectionTitle>
        <CardList>
          {balances.map((balance) => {
            const member = membersById.get(balance.userId);
            return (
              <div key={balance.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar
                  id={balance.userId}
                  name={member?.displayName ?? '?'}
                  color={member?.avatarColor}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ink">
                    {balance.userId === currentUserId ? 'Moi' : nameOf(balance.userId)}
                  </span>
                  <span className="block text-[12.5px] text-subtle tabular">
                    a avancé {formatMoney(balance.paidCents, currency, { compact: true })}
                  </span>
                </span>
                <Amount cents={balance.netCents} currency={currency} tone="balance" signed />
              </div>
            );
          })}
        </CardList>
      </section>

      <SettleSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        members={members.filter((member) => member.id !== currentUserId)}
        suggestions={iOwe}
      />
    </div>
  );
}

function TransferRow({
  label,
  userId,
  name,
  color,
  amountCents,
  currency,
  action,
}: {
  label: string;
  userId: string;
  name: string;
  color?: string;
  amountCents: number;
  currency: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar id={userId} name={name} color={color} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{label}</span>
      <Amount cents={amountCents} currency={currency} className="text-[15px] font-medium" />
      {action}
    </div>
  );
}
