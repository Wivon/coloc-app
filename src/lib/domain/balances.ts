import 'server-only';

import { db, unwrap } from '@/lib/db/client';
import { today } from '@/lib/date';
import { isValidAmountCents } from '@/lib/money';
import type { IsoDate, SettlementInput, SettlementRow, Uuid } from '@/lib/db/types';
import {
  balancesFromTotals,
  simplifyDebts,
  type Balance,
  type Transfer,
  type UserTotals,
} from './balance-math';

export type { Balance, Transfer };

export interface BalanceSummary {
  balances: Balance[];
  /** Virements à effectuer pour tout remettre à plat. */
  transfers: Transfer[];
}

export interface NewSettlement {
  fromUserId: Uuid;
  toUserId: Uuid;
  amountCents: number;
  note?: string;
  settledOn?: IsoDate;
  /**
   * Jeton d'intention, tiré par l'interface et stable tant que le bouton reste à
   * l'écran. Rejouer le même enregistrement (double tap, retry réseau) met la
   * ligne à jour au lieu d'en créer une seconde.
   *
   * Facultatif : les appels qui recalculent leur montant côté serveur sont déjà
   * idempotents — après un premier succès il n'y a plus rien à solder — et
   * réutiliser un jeton sur un ensemble de virements recalculé ferait au contraire
   * retomber le rejeu sur la ligne d'un autre coloc.
   */
  clientToken?: Uuid;
}

/**
 * Derniers remboursements, pour l'affichage uniquement — `limit` est donc un
 * plafond d'écran, jamais une entrée de calcul. Les soldes viennent de
 * `getBalanceSummary`, qui agrège en base.
 */
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

/**
 * Soldes de la colocation, agrégés par Postgres.
 *
 * L'agrégation est faite en base et non en mémoire : remonter tout l'historique
 * se heurtait au plafond de lignes de l'API, qui tronquait les dépenses les plus
 * anciennes en silence — des dépenses déjà remboursées réapparaissaient comme dues.
 */
export async function getBalanceSummary(
  householdId: Uuid,
  memberIds: Uuid[],
): Promise<BalanceSummary> {
  const rows = unwrap(await db().rpc('household_balances', { p_household_id: householdId }));

  const totals: UserTotals[] = rows.map((row) => ({
    userId: row.user_id,
    paidCents: row.paid_cents,
    owedCents: row.owed_cents,
    settledOutCents: row.settled_out_cents,
    settledInCents: row.settled_in_cents,
  }));

  const balances = balancesFromTotals(memberIds, totals);
  return { balances, transfers: simplifyDebts(balances) };
}

/**
 * Enregistre un ou plusieurs remboursements, en une seule transaction.
 *
 * Cela ne « supprime » aucune dépense : le versement entre simplement dans le
 * calcul du solde, ce qui garde l'historique complet et réversible. Le lot est
 * atomique — « Tout régler » ne peut plus s'arrêter à mi-parcours en laissant
 * une partie des virements enregistrés.
 */
export async function recordSettlements(
  householdId: Uuid,
  createdBy: Uuid,
  inputs: NewSettlement[],
): Promise<SettlementRow[]> {
  if (inputs.length === 0) return [];

  const payload: SettlementInput[] = inputs.map((input) => {
    if (input.fromUserId === input.toUserId) {
      throw new Error('Impossible de se rembourser soi-même.');
    }
    if (!isValidAmountCents(input.amountCents)) {
      throw new Error('Montant invalide.');
    }

    return {
      from_user_id: input.fromUserId,
      to_user_id: input.toUserId,
      amount_cents: input.amountCents,
      note: input.note?.trim() || null,
      settled_on: input.settledOn ?? today(),
      client_token: input.clientToken ?? null,
    };
  });

  return unwrap(
    await db().rpc('record_settlements', {
      p_household_id: householdId,
      p_created_by: createdBy,
      p_settlements: payload,
    }),
  );
}

export async function deleteSettlement(householdId: Uuid, settlementId: Uuid): Promise<void> {
  const deleted = unwrap(
    await db()
      .from('settlements')
      .delete()
      .eq('id', settlementId)
      .eq('household_id', householdId)
      .select('id'),
  );

  if (deleted.length === 0) throw new Error('Remboursement introuvable.');
}
