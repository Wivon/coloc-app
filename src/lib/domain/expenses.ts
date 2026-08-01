import 'server-only';

import { db, unwrap } from '@/lib/db/client';
import { isValidAmountCents, offsetFromId, splitEvenly } from '@/lib/money';
import { today } from '@/lib/date';
import type { ExpenseRow, ExpenseShareRow, IsoDate, Uuid } from '@/lib/db/types';

/**
 * Taille de page des lectures. L'API PostgREST plafonne le nombre de lignes
 * renvoyées (1000 par défaut chez Supabase) : une requête sans pagination était
 * tronquée en silence, sans erreur — et les totaux calculés dessus étaient faux.
 */
const PAGE_SIZE = 500;

export interface ExpenseShare {
  userId: Uuid;
  amountCents: number;
}

export interface Expense {
  id: Uuid;
  payerId: Uuid;
  amountCents: number;
  description: string;
  category: string;
  spentOn: IsoDate;
  createdBy: Uuid;
  shares: ExpenseShare[];
}

export interface NewExpenseInput {
  payerId: Uuid;
  amountCents: number;
  description: string;
  category: string;
  spentOn: IsoDate;
  /** Colocs concernés. Par défaut, tous les membres de la colocation. */
  participantIds: Uuid[];
}

/**
 * Avec `limit`, une seule requête : les `limit` dépenses les plus récentes.
 * Sans `limit`, remonte **toutes** les dépenses correspondantes — un total
 * calculé sur une liste tronquée est un total faux.
 */
export async function listExpenses(
  householdId: Uuid,
  options: { from?: IsoDate; to?: IsoDate; limit?: number } = {},
): Promise<Expense[]> {
  const select = () => {
    let query = db()
      .from('expenses')
      .select('*, expense_shares(user_id, amount_cents)')
      .eq('household_id', householdId);

    if (options.from) query = query.gte('spent_on', options.from);
    if (options.to) query = query.lte('spent_on', options.to);
    return query;
  };

  if (options.limit !== undefined) {
    const rows = unwrap(
      await select()
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) // départage : sans clé unique, l'ordre flotte
        .limit(options.limit)
        .returns<ExpenseWithShares[]>(),
    );
    return rows.map(toExpense);
  }

  // Pagination dans l'ordre d'insertion, et pas par date de dépense : une dépense
  // ajoutée pendant le parcours s'ajoute alors à la fin et ne décale aucune page
  // déjà lue. Avec un tri par `spent_on`, elle s'insérerait au milieu — des lignes
  // seraient rendues deux fois, d'autres jamais, et les totaux calculés dessus
  // seraient faux dans les deux sens.
  const rows: ExpenseWithShares[] = [];
  for (let offset = 0; ; ) {
    const batch = unwrap(
      await select()
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
        .returns<ExpenseWithShares[]>(),
    );

    rows.push(...batch);
    if (batch.length === 0) break;

    // On avance du nombre de lignes réellement reçues, pas de `PAGE_SIZE` : si le
    // plafond de l'API est plus bas que la page demandée, s'arrêter sur une page
    // courte — ou sauter l'écart — ramènerait la troncature silencieuse.
    offset += batch.length;
  }

  return rows.sort(byMostRecent).map(toExpense);
}

/** Même ordre d'affichage que la lecture plafonnée : la plus récente d'abord. */
function byMostRecent(a: ExpenseWithShares, b: ExpenseWithShares): number {
  return (
    b.spent_on.localeCompare(a.spent_on) ||
    b.created_at.localeCompare(a.created_at) ||
    b.id.localeCompare(a.id)
  );
}

export async function getExpense(householdId: Uuid, expenseId: Uuid): Promise<Expense | null> {
  const { data } = await db()
    .from('expenses')
    .select('*, expense_shares(user_id, amount_cents)')
    .eq('household_id', householdId)
    .eq('id', expenseId)
    .maybeSingle<ExpenseRow & { expense_shares: Omit<ExpenseShareRow, 'expense_id'>[] }>();

  return data ? toExpense(data) : null;
}

/**
 * Enregistre une dépense et sa répartition, en une seule transaction.
 *
 * Le partage est égal entre les participants, au centime près (`splitEvenly`) :
 * la somme des parts est toujours exactement le montant payé — garanti côté base
 * par `create_expense_with_shares` et par le trigger `expense_shares_sum_check`.
 * Une dépense sans parts, qui créditerait le payeur sans débiter personne, ne
 * peut plus exister. Le schéma stocke un montant par participant, donc des parts
 * personnalisées pourront être ajoutées plus tard sans migration.
 *
 * L'identifiant est tiré ici plutôt qu'en base : il sert de graine au décalage
 * d'arrondi, pour que le centime en trop ne retombe pas toujours sur le même coloc.
 */
export async function createExpense(
  householdId: Uuid,
  createdBy: Uuid,
  input: NewExpenseInput,
): Promise<Expense> {
  const participants = dedupe(input.participantIds);
  if (participants.length === 0) throw new Error('Sélectionnez au moins un coloc.');
  if (!isValidAmountCents(input.amountCents)) throw new Error('Montant invalide.');

  const id = crypto.randomUUID();
  const amounts = splitEvenly(
    input.amountCents,
    participants.length,
    offsetFromId(id, participants.length),
  );
  const shares = participants.map((userId, index) => ({
    user_id: userId,
    amount_cents: amounts[index],
  }));

  const expense = unwrap(
    await db().rpc('create_expense_with_shares', {
      p_id: id,
      p_household_id: householdId,
      p_payer_id: input.payerId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_category: input.category,
      p_spent_on: input.spentOn || today(),
      p_created_by: createdBy,
      p_shares: shares,
    }),
  );

  return toExpense({ ...expense, expense_shares: shares });
}

export async function deleteExpense(householdId: Uuid, expenseId: Uuid): Promise<void> {
  const deleted = unwrap(
    await db()
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('household_id', householdId)
      .select('id'),
  );

  // Sans ce contrôle, un identifiant inconnu ou d'une autre colocation renvoyait
  // un succès et l'interface se fermait comme si la suppression avait eu lieu.
  if (deleted.length === 0) throw new Error('Dépense introuvable.');
}

type ExpenseWithShares = ExpenseRow & { expense_shares: Omit<ExpenseShareRow, 'expense_id'>[] };

function toExpense(row: ExpenseWithShares): Expense {
  return {
    id: row.id,
    payerId: row.payer_id,
    amountCents: row.amount_cents,
    description: row.description,
    category: row.category,
    spentOn: row.spent_on,
    createdBy: row.created_by,
    shares: (row.expense_shares ?? []).map((share) => ({
      userId: share.user_id,
      amountCents: share.amount_cents,
    })),
  };
}

function dedupe(ids: Uuid[]): Uuid[] {
  return [...new Set(ids)];
}
