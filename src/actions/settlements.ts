'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { formatMoney, parseAmountToCents } from '@/lib/money';
import { deleteSettlement, getBalanceSummary, recordSettlement } from '@/lib/domain/balances';
import { requireHouseholdContext } from '@/lib/domain/households';
import { notifyInBackground } from '@/lib/domain/push';

/** Enregistre un remboursement saisi à la main. */
export async function settleAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();

    const toUserId = String(formData.get('toUserId') ?? '');
    const amountCents = parseAmountToCents(String(formData.get('amount') ?? ''));
    if (!amountCents) throw new Error('Montant invalide.');
    if (!members.some((member) => member.id === toUserId)) throw new Error('Coloc inconnu.');

    await recordSettlement(household.id, user.id, {
      fromUserId: user.id,
      toUserId,
      amountCents,
      note: String(formData.get('note') ?? ''),
    });

    notifyInBackground([toUserId], {
      title: `Remboursement de ${formatMoney(amountCents, household.currency)}`,
      body: `${user.display_name} t’a remboursé.`,
      url: '/balances',
      tag: 'settlement',
    });

    revalidateMoneyPages();
  });
}

/**
 * Solde tout ce que l'utilisateur doit, en une fois.
 *
 * On recalcule les virements côté serveur au moment du clic : le montant affiché
 * peut être périmé si un coloc a ajouté une dépense entre-temps.
 */
export async function settleAllAction(): Promise<ActionResult<number>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();
    const { transfers } = await getBalanceSummary(
      household.id,
      members.map((member) => member.id),
    );

    const mine = transfers.filter((transfer) => transfer.fromUserId === user.id);
    for (const transfer of mine) {
      await recordSettlement(household.id, user.id, {
        fromUserId: user.id,
        toUserId: transfer.toUserId,
        amountCents: transfer.amountCents,
        note: 'Solde du mois',
      });

      notifyInBackground([transfer.toUserId], {
        title: `Remboursement de ${formatMoney(transfer.amountCents, household.currency)}`,
        body: `${user.display_name} a soldé ses comptes.`,
        url: '/balances',
        tag: 'settlement',
      });
    }

    revalidateMoneyPages();
    return mine.length;
  });
}

/** Marque un virement suggéré comme effectué. */
export async function settleTransferAction(
  toUserId: string,
  amountCents: number,
): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();
    if (!members.some((member) => member.id === toUserId)) throw new Error('Coloc inconnu.');

    await recordSettlement(household.id, user.id, {
      fromUserId: user.id,
      toUserId,
      amountCents,
      note: 'Remboursement',
    });

    notifyInBackground([toUserId], {
      title: `Remboursement de ${formatMoney(amountCents, household.currency)}`,
      body: `${user.display_name} t’a remboursé.`,
      url: '/balances',
      tag: 'settlement',
    });

    revalidateMoneyPages();
  });
}

export async function deleteSettlementAction(settlementId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    await deleteSettlement(household.id, settlementId);
    revalidateMoneyPages();
  });
}

function revalidateMoneyPages(): void {
  revalidatePath('/balances');
  revalidatePath('/expenses');
  revalidatePath('/insights');
}
