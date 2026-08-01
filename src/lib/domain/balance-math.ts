import type { Uuid } from '@/lib/db/types';

/**
 * Calcul des soldes et des remboursements — logique pure, sans accès base,
 * pour rester testable et réutilisable côté client.
 */

export interface BalanceInputExpense {
  payerId: Uuid;
  amountCents: number;
  shares: { userId: Uuid; amountCents: number }[];
}

export interface BalanceInputSettlement {
  fromUserId: Uuid;
  toUserId: Uuid;
  amountCents: number;
}

export interface Balance {
  userId: Uuid;
  /** Total avancé par la personne. */
  paidCents: number;
  /** Total de ses parts dans les dépenses. */
  owedCents: number;
  /** Remboursements versés (−) et reçus (+). */
  settledOutCents: number;
  settledInCents: number;
  /** > 0 : on lui doit de l'argent. < 0 : elle doit de l'argent. */
  netCents: number;
}

export interface Transfer {
  fromUserId: Uuid;
  toUserId: Uuid;
  amountCents: number;
}

/** Totaux déjà agrégés pour une personne, dans l'ordre des colonnes de `Balance`. */
export type UserTotals = Omit<Balance, 'netCents'>;

/**
 * Assemble les soldes à partir de totaux déjà agrégés.
 *
 * C'est le point de passage unique du calcul de `netCents`, qu'ils viennent d'une
 * agrégation SQL (`household_balances`) ou d'un calcul en mémoire
 * (`computeBalances`) : les deux chemins ne peuvent pas diverger.
 */
export function balancesFromTotals(memberIds: Uuid[], totals: UserTotals[]): Balance[] {
  const byUser = new Map<Uuid, Balance>(memberIds.map((userId) => [userId, empty(userId)]));

  for (const total of totals) {
    // Un ancien coloc peut apparaître dans l'historique sans être membre.
    let balance = byUser.get(total.userId);
    if (!balance) {
      balance = empty(total.userId);
      byUser.set(total.userId, balance);
    }

    balance.paidCents += total.paidCents;
    balance.owedCents += total.owedCents;
    balance.settledOutCents += total.settledOutCents;
    balance.settledInCents += total.settledInCents;
  }

  for (const balance of byUser.values()) {
    balance.netCents =
      balance.paidCents - balance.owedCents + balance.settledOutCents - balance.settledInCents;
  }

  return [...byUser.values()];
}

/**
 * Agrégation en mémoire, à partir de l'historique complet.
 *
 * Sur une colocation réelle les soldes viennent de `household_balances` — remonter
 * toutes les dépenses ne passe pas à l'échelle. Cette version reste la définition
 * exécutable du modèle, et c'est elle que couvrent les tests.
 */
export function computeBalances(
  memberIds: Uuid[],
  expenses: BalanceInputExpense[],
  settlements: BalanceInputSettlement[],
): Balance[] {
  const totals = new Map<Uuid, UserTotals>();
  const ensure = (userId: Uuid) => {
    let total = totals.get(userId);
    if (!total) {
      total = { userId, paidCents: 0, owedCents: 0, settledOutCents: 0, settledInCents: 0 };
      totals.set(userId, total);
    }
    return total;
  };

  for (const expense of expenses) {
    ensure(expense.payerId).paidCents += expense.amountCents;
    for (const share of expense.shares) ensure(share.userId).owedCents += share.amountCents;
  }

  for (const settlement of settlements) {
    ensure(settlement.fromUserId).settledOutCents += settlement.amountCents;
    ensure(settlement.toUserId).settledInCents += settlement.amountCents;
  }

  return balancesFromTotals(memberIds, [...totals.values()]);
}

const empty = (userId: Uuid): Balance => ({
  userId,
  paidCents: 0,
  owedCents: 0,
  settledOutCents: 0,
  settledInCents: 0,
  netCents: 0,
});

/**
 * Réduit les soldes au plus petit nombre de virements possible.
 *
 * Algorithme glouton : on apparie à chaque tour le plus gros créancier avec le
 * plus gros débiteur. Avec n personnes, on obtient au plus n−1 virements — au
 * lieu de rembourser chacun individuellement pour chaque dépense.
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ userId: b.userId, amount: b.netCents }))
    .sort(byAmountDesc);
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, amount: -b.netCents }))
    .sort(byAmountDesc);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amountCents: amount,
      });
    }

    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }

  return transfers;
}

/** Ce que `userId` doit encore verser, et à qui. */
export function transfersFrom(transfers: Transfer[], userId: Uuid): Transfer[] {
  return transfers.filter((transfer) => transfer.fromUserId === userId);
}

/** Ce qu'on doit encore verser à `userId`. */
export function transfersTo(transfers: Transfer[], userId: Uuid): Transfer[] {
  return transfers.filter((transfer) => transfer.toUserId === userId);
}

const byAmountDesc = (a: { amount: number }, b: { amount: number }) => b.amount - a.amount;
