'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { isExpenseCategory } from '@/lib/categories';
import { formatMoney, parseAmountToCents } from '@/lib/money';
import { addDays, isIsoDate, today } from '@/lib/date';
import { createExpense, deleteExpense } from '@/lib/domain/expenses';
import { requireHouseholdContext } from '@/lib/domain/households';
import { notifyInBackground } from '@/lib/domain/push';

/** Aligné sur le `maxLength` du champ ; le formulaire n'engage que le navigateur. */
const MAX_DESCRIPTION_LENGTH = 120;

export async function addExpenseAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();

    const amountCents = parseAmountToCents(String(formData.get('amount') ?? ''));
    if (!amountCents) throw new Error('Montant invalide.');

    const description = String(formData.get('description') ?? '').trim();
    if (!description) throw new Error('Ajoutez un libellé.');
    if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error('Libellé trop long.');

    const category = String(formData.get('category') ?? 'other');
    const payerId = String(formData.get('payerId') ?? user.id);

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

    await createExpense(household.id, user.id, {
      payerId,
      amountCents,
      description,
      category: isExpenseCategory(category) ? category : 'other',
      spentOn,
      participantIds,
    });

    notifyInBackground(
      participantIds.filter((id) => id !== user.id),
      {
        title: `${description} · ${formatMoney(amountCents, household.currency)}`,
        body: `${payerName(members, payerId)} a ajouté une dépense partagée.`,
        url: '/expenses',
        tag: 'expense',
      },
    );

    revalidatePath('/expenses');
    revalidatePath('/balances');
    revalidatePath('/insights');
  });
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    await deleteExpense(household.id, expenseId);

    revalidatePath('/expenses');
    revalidatePath('/balances');
    revalidatePath('/insights');
  });
}

function payerName(members: { id: string; displayName: string }[], payerId: string): string {
  return members.find((member) => member.id === payerId)?.displayName ?? 'Un coloc';
}
