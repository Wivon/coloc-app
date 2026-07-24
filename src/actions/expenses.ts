'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { isExpenseCategory } from '@/lib/categories';
import { formatMoney, parseAmountToCents } from '@/lib/money';
import { today } from '@/lib/date';
import { createExpense, deleteExpense } from '@/lib/domain/expenses';
import { requireHouseholdContext } from '@/lib/domain/households';
import { notifyInBackground } from '@/lib/domain/push';

export async function addExpenseAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household, user, members } = await requireHouseholdContext();

    const amountCents = parseAmountToCents(String(formData.get('amount') ?? ''));
    if (!amountCents) throw new Error('Montant invalide.');

    const description = String(formData.get('description') ?? '').trim();
    if (!description) throw new Error('Ajoutez un libellé.');

    const category = String(formData.get('category') ?? 'other');
    const payerId = String(formData.get('payerId') ?? user.id);
    const spentOn = String(formData.get('spentOn') ?? '') || today();

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
