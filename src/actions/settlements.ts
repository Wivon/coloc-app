'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { isClientToken } from '@/lib/client-token';
import { formatMoney, parseAmountToCents } from '@/lib/money';
import { deleteSettlement, getBalanceSummary, recordSettlements } from '@/lib/domain/balances';
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

    await recordSettlements(household.id, user.id, [
      {
        fromUserId: user.id,
        toUserId,
        amountCents,
        note: String(formData.get('note') ?? ''),
        clientToken: requireToken(formData.get('clientToken')),
      },
    ]);

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
 * peut être périmé si un coloc a ajouté une dépense entre-temps. Le lot est écrit
 * en une transaction, il ne peut donc pas s'appliquer à moitié.
 */
export async function settleAllAction(): Promise<ActionResult<number>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();

    const mine = await myTransfers(household.id, user.id, members);
    if (mine.length === 0) return 0;

    // Pas de jeton d'intention ici : le recalcul le rend inutile, et il serait
    // même nuisible. Une fois le lot écrit il ne reste plus rien à solder, donc un
    // rejeu repart de `mine.length === 0`. À l'inverse, réutiliser un jeton sur un
    // ensemble de virements qui a changé entre-temps ferait retomber le rejeu sur
    // la ligne d'un autre coloc.
    await recordSettlements(
      household.id,
      user.id,
      mine.map((transfer) => ({
        fromUserId: user.id,
        toUserId: transfer.toUserId,
        amountCents: transfer.amountCents,
        note: 'Solde du mois',
      })),
    );

    for (const transfer of mine) {
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

/**
 * Marque un virement suggéré comme effectué.
 *
 * Le montant enregistré est bien celui qui était **affiché** : en tapant « Payé »
 * sous « À Bob · 12,00 € », l'utilisateur déclare avoir viré 12 € — ce qui reste
 * vrai même si un coloc a ajouté une dépense entre-temps. Le recalculer au moment
 * du clic enregistrerait une somme qu'il n'a jamais versée. Il est en revanche
 * validé : une Server Action est appelable avec n'importe quelle valeur.
 *
 * C'est aussi pour ça que ce chemin garde un jeton d'intention, contrairement à
 * `settleAllAction` : sans recalcul, rien d'autre n'empêche le doublon.
 */
export async function settleTransferAction(
  toUserId: string,
  amountCents: number,
  clientToken: string,
): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();
    const token = requireToken(clientToken);
    if (!members.some((member) => member.id === toUserId)) throw new Error('Coloc inconnu.');

    await recordSettlements(household.id, user.id, [
      {
        fromUserId: user.id,
        toUserId,
        amountCents,
        note: 'Remboursement',
        clientToken: token,
      },
    ]);

    notifyInBackground([toUserId], {
      title: `Remboursement de ${formatMoney(amountCents, household.currency)}`,
      body: `${user.display_name} t’a remboursé.`,
      url: '/balances',
      tag: 'settlement',
    });

    revalidateMoneyPages();
  });
}

/** Annule un remboursement enregistré par erreur. */
export async function deleteSettlementAction(settlementId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    await deleteSettlement(household.id, settlementId);
    revalidateMoneyPages();
  });
}

/** Virements que `userId` doit encore effectuer, d'après les soldes actuels. */
async function myTransfers(
  householdId: string,
  userId: string,
  members: { id: string }[],
): Promise<{ toUserId: string; amountCents: number }[]> {
  const { transfers } = await getBalanceSummary(
    householdId,
    members.map((member) => member.id),
  );

  return transfers
    .filter((transfer) => transfer.fromUserId === userId)
    .map((transfer) => ({ toUserId: transfer.toUserId, amountCents: transfer.amountCents }));
}

function requireToken(value: FormDataEntryValue | string | null): string {
  const token = String(value ?? '');
  if (!isClientToken(token)) throw new Error('Requête invalide.');
  return token;
}

function revalidateMoneyPages(): void {
  revalidatePath('/balances');
  revalidatePath('/expenses');
  revalidatePath('/insights');
}
