'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { isExpenseCategory } from '@/lib/categories';
import { formatMoney, parseAmountToCents } from '@/lib/money';
import { addDays, isIsoDate, today } from '@/lib/date';
import {
  createExpense,
  deleteExpense,
  updateExpense,
  type NewExpenseInput,
} from '@/lib/domain/expenses';
import { requireHouseholdContext, type Member } from '@/lib/domain/households';
import { notifyInBackground } from '@/lib/domain/push';
import type { Uuid } from '@/lib/db/types';

/** Aligné sur le `maxLength` du champ ; le formulaire n'engage que le navigateur. */
const MAX_DESCRIPTION_LENGTH = 120;

/** Un identifiant mal formé doit échouer ici, pas en `invalid input syntax` Postgres. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addExpenseAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();
    const input = readExpenseForm(formData, members, user.id);

    await createExpense(household.id, user.id, input);

    notifyInBackground(
      input.participantIds.filter((id) => id !== user.id),
      {
        title: `${input.description} · ${formatMoney(input.amountCents, household.currency)}`,
        body: `${payerName(members, input.payerId)} a ajouté une dépense partagée.`,
        url: '/expenses',
        tag: 'expense',
      },
    );

    revalidateMoney();
  });
}

/**
 * Corrige une dépense existante — montant, libellé, payeur, participants, date.
 *
 * Rien n'est notifié : contrairement à un ajout, une correction est le plus
 * souvent une faute de frappe rattrapée dans la foulée, et l'écran des soldes
 * montre déjà le résultat.
 */
export async function updateExpenseAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();

    const expenseId = String(formData.get('expenseId') ?? '');
    if (!UUID_PATTERN.test(expenseId)) throw new Error('Dépense introuvable.');

    await updateExpense(household.id, expenseId, readExpenseForm(formData, members, user.id));

    revalidateMoney();
  });
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    await deleteExpense(household.id, expenseId);

    revalidateMoney();
  });
}

/**
 * Lecture et validation du formulaire de dépense, commune à l'ajout et à la
 * correction : les deux écrivent les mêmes colonnes et méritent donc exactement
 * les mêmes garde-fous. Les Server Actions peuvent être appelées avec n'importe
 * quel `FormData`, pas seulement celui qu'a rendu l'interface.
 */
function readExpenseForm(
  formData: FormData,
  members: Member[],
  currentUserId: Uuid,
): NewExpenseInput {
  const amountCents = parseAmountToCents(String(formData.get('amount') ?? ''));
  if (!amountCents) throw new Error('Montant invalide.');

  const description = String(formData.get('description') ?? '').trim();
  if (!description) throw new Error('Ajoutez un libellé.');
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error('Libellé trop long.');

  const category = String(formData.get('category') ?? 'other');
  const payerId = String(formData.get('payerId') ?? currentUserId);

  // `max={today()}` sur le champ n'engage que le navigateur : sans ce contrôle,
  // une date inexistante remontait jusqu'à Postgres et son erreur brute
  // s'affichait à l'utilisateur.
  //
  // La borne haute tolère un jour : le formulaire pré-remplit la date dans le
  // fuseau du téléphone, le serveur tourne en UTC. Sans cette marge, un coloc en
  // France se verrait refuser un formulaire non modifié entre minuit et 2 h.
  const spentOn = String(formData.get('spentOn') ?? '') || today();
  if (!isIsoDate(spentOn)) throw new Error('Date invalide.');
  if (spentOn > addDays(today(), 1)) throw new Error('La date ne peut pas être dans le futur.');

  // Par défaut, la dépense est partagée avec toute la colocation.
  const selected = formData.getAll('participants').map(String);
  const participantIds = selected.length > 0 ? selected : members.map((member) => member.id);

  const memberIds = new Set(members.map((member) => member.id));
  if (!memberIds.has(payerId)) throw new Error('Payeur inconnu.');
  if (participantIds.some((id) => !memberIds.has(id))) throw new Error('Participant inconnu.');

  return {
    payerId,
    amountCents,
    description,
    category: isExpenseCategory(category) ? category : 'other',
    spentOn,
    participantIds,
  };
}

/** Une dépense pèse sur les trois écrans qui comptent de l'argent. */
function revalidateMoney(): void {
  revalidatePath('/expenses');
  revalidatePath('/balances');
  revalidatePath('/insights');
}

function payerName(members: { id: string; displayName: string }[], payerId: string): string {
  return members.find((member) => member.id === payerId)?.displayName ?? 'Un coloc';
}
