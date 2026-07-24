import 'server-only';

import { db, unwrap } from '@/lib/db/client';
import { today } from '@/lib/date';
import type { IsoDate, SettlementRow, Uuid } from '@/lib/db/types';
import { listExpenses } from './expenses';
import { computeBalances, simplifyDebts, type Balance, type Transfer } from './balance-math';

export type { Balance, Transfer };

export interface BalanceSummary {
  balances: Balance[];
  /** Virements à effectuer pour tout remettre à plat. */
  transfers: Transfer[];
  /** Total des dépenses prises en compte. */
  totalSpentCents: number;
}

export async function listSettlements(householdId: Uuid, limit = 50): Promise<SettlementRow[]> {
  return unwrap(
    await db()
      .from('settlements')
      .select('*')
      .eq('household_id', householdId)
      .order('settled_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

export async function getBalanceSummary(
  householdId: Uuid,
  memberIds: Uuid[],
): Promise<BalanceSummary> {
  const [expenses, settlements] = await Promise.all([
    listExpenses(householdId),
    listSettlements(householdId, 1000),
  ]);

  const balances = computeBalances(
    memberIds,
    expenses,
    settlements.map((row) => ({
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      amountCents: row.amount_cents,
    })),
  );

  return {
    balances,
    transfers: simplifyDebts(balances),
    totalSpentCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
  };
}

/**
 * Enregistre un remboursement. Cela ne « supprime » aucune dépense : le
 * versement entre simplement dans le calcul du solde, ce qui garde l'historique
 * complet et réversible.
 */
export async function recordSettlement(
  householdId: Uuid,
  createdBy: Uuid,
  input: { fromUserId: Uuid; toUserId: Uuid; amountCents: number; note?: string; settledOn?: IsoDate },
): Promise<SettlementRow> {
  if (input.fromUserId === input.toUserId) {
    throw new Error('Impossible de se rembourser soi-même.');
  }
  if (input.amountCents <= 0) throw new Error('Le montant doit être supérieur à zéro.');

  return unwrap(
    await db()
      .from('settlements')
      .insert({
        household_id: householdId,
        from_user_id: input.fromUserId,
        to_user_id: input.toUserId,
        amount_cents: input.amountCents,
        note: input.note?.trim() || null,
        settled_on: input.settledOn ?? today(),
        created_by: createdBy,
      })
      .select()
      .single(),
  );
}

export async function deleteSettlement(householdId: Uuid, settlementId: Uuid): Promise<void> {
  await db().from('settlements').delete().eq('id', settlementId).eq('household_id', householdId);
}
