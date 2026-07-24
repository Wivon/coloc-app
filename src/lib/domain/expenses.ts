import 'server-only';

import { db, unwrap } from '@/lib/db/client';
import { splitEvenly } from '@/lib/money';
import { today } from '@/lib/date';
import type { ExpenseRow, ExpenseShareRow, IsoDate, Uuid } from '@/lib/db/types';

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

export async function listExpenses(
  householdId: Uuid,
  options: { from?: IsoDate; to?: IsoDate; limit?: number } = {},
): Promise<Expense[]> {
  let query = db()
    .from('expenses')
    .select('*, expense_shares(user_id, amount_cents)')
    .eq('household_id', householdId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (options.from) query = query.gte('spent_on', options.from);
  if (options.to) query = query.lte('spent_on', options.to);
  if (options.limit) query = query.limit(options.limit);

  const rows = unwrap(
    await query.returns<(ExpenseRow & { expense_shares: Omit<ExpenseShareRow, 'expense_id'>[] })[]>(),
  );

  return rows.map(toExpense);
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
 * Enregistre une dépense et sa répartition.
 *
 * Le partage est égal entre les participants, au centime près (`splitEvenly`) :
 * la somme des parts est toujours exactement le montant payé. Le schéma stocke un
 * montant par participant, donc des parts personnalisées pourront être ajoutées
 * plus tard sans migration.
 */
export async function createExpense(
  householdId: Uuid,
  createdBy: Uuid,
  input: NewExpenseInput,
): Promise<Expense> {
  const participants = dedupe(input.participantIds);
  if (participants.length === 0) throw new Error('Sélectionnez au moins un coloc.');
  if (input.amountCents <= 0) throw new Error('Le montant doit être supérieur à zéro.');

  const expense = unwrap(
    await db()
      .from('expenses')
      .insert({
        household_id: householdId,
        payer_id: input.payerId,
        amount_cents: input.amountCents,
        description: input.description,
        category: input.category,
        spent_on: input.spentOn || today(),
        created_by: createdBy,
      })
      .select()
      .single(),
  );

  const amounts = splitEvenly(input.amountCents, participants.length);
  const shares = participants.map((userId, index) => ({
    expense_id: expense.id,
    user_id: userId,
    amount_cents: amounts[index],
  }));

  const { error } = await db().from('expense_shares').insert(shares);
  if (error) {
    // Sans ses parts, la dépense fausserait tous les soldes : on annule.
    await db().from('expenses').delete().eq('id', expense.id);
    throw new Error(error.message);
  }

  return {
    ...toExpense({ ...expense, expense_shares: [] }),
    shares: shares.map((share) => ({ userId: share.user_id, amountCents: share.amount_cents })),
  };
}

export async function deleteExpense(householdId: Uuid, expenseId: Uuid): Promise<void> {
  await db().from('expenses').delete().eq('id', expenseId).eq('household_id', householdId);
}

function toExpense(
  row: ExpenseRow & { expense_shares: Omit<ExpenseShareRow, 'expense_id'>[] },
): Expense {
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
