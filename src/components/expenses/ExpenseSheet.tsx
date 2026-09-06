'use client';

import { useState } from 'react';

import { addExpenseAction, updateExpenseAction } from '@/actions/expenses';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { centsToInput, formatMoney, parseAmountToCents, splitEvenly } from '@/lib/money';
import { useFormAction } from '@/lib/use-form-action';
import type { Expense } from '@/lib/domain/expenses';
import type { Member } from '@/lib/domain/households';

/**
 * Longueur maximale du montant saisi : « 99999999,99 ». Sans plafond, le champ
 * — dont la largeur suit le nombre de caractères — finissait par dépasser la
 * feuille, et `parseAmountToCents` refusait de toute façon la valeur.
 */
const MAX_AMOUNT_LENGTH = 11;

/**
 * Saisie d'une dépense : nouvelle si `expense` est absent, correction sinon.
 *
 * Les deux écrans remplissent exactement les mêmes champs — une correction qui
 * s'ouvrirait sur un formulaire réduit obligerait à supprimer puis ressaisir dès
 * qu'on veut toucher au partage. Un seul composant, donc, et les valeurs
 * initiales font toute la différence.
 *
 * Monté uniquement quand la feuille est ouverte (voir `AddExpenseButton` et
 * `ExpensesView`) : la saisie repart de la dépense affichée à chaque ouverture,
 * sans code de remise à zéro.
 */
export function ExpenseSheet({
  expense,
  onClose,
  members,
  currentUserId,
  currency,
}: {
  /** Dépense à corriger. Absente : on en crée une. */
  expense?: Expense;
  onClose: () => void;
  members: Member[];
  currentUserId: string;
  currency: string;
}) {
  const editing = expense !== undefined;
  const allIds = members.map((member) => member.id);

  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : '');
  const [category, setCategory] = useState<string>(expense?.category ?? 'courses');
  const [payerId, setPayerId] = useState(expense?.payerId ?? currentUserId);
  // Par défaut, tout le monde partage.
  const [participants, setParticipants] = useState<string[]>(() =>
    expense ? initialParticipants(expense, allIds) : allIds,
  );

  const { submit, error } = useFormAction(
    editing ? updateExpenseAction : addExpenseAction,
    onClose,
  );

  const amountCents = parseAmountToCents(amount) ?? 0;
  const shareCents =
    participants.length > 0 ? splitEvenly(amountCents, participants.length)[0] : 0;

  function toggleParticipant(id: string) {
    setParticipants((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <Sheet open onClose={onClose} title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}>
      <form action={submit} className="flex flex-col gap-5">
        {expense && <input type="hidden" name="expenseId" value={expense.id} />}

        <div className="flex flex-col items-center gap-1 pb-1">
          {/* `max-w-full` + `min-w-0` sur le champ : sur un petit écran, un
              montant long rétrécit le champ et défile dedans, au lieu de pousser
              la feuille au-delà de sa largeur. */}
          <div className="flex max-w-full items-baseline gap-1">
            <input
              name="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              // Sur une correction, la feuille s'ouvre pour être relue : ouvrir le
              // clavier d'emblée masquerait la moitié du formulaire.
              autoFocus={!editing}
              required
              maxLength={MAX_AMOUNT_LENGTH}
              aria-label="Montant"
              className="w-[5.5ch] min-w-0 border-none bg-transparent text-center text-[40px] font-semibold tabular text-ink outline-none placeholder:text-subtle"
              style={{ width: `${Math.max(4, amount.length + 1)}ch` }}
            />
            <span className="text-[28px] font-medium text-subtle">€</span>
          </div>
          {participants.length > 0 && amountCents > 0 && (
            <p className="text-[13px] text-muted">
              {formatMoney(shareCents, currency)} par personne · {participants.length} coloc
              {participants.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <Field label="C’était pour quoi ?">
          <Input
            name="description"
            placeholder="Courses de la semaine"
            defaultValue={expense?.description}
            required
            maxLength={120}
          />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Catégorie</p>
          <input type="hidden" name="category" value={category} />
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((option) => (
              <Chip
                key={option.id}
                selected={category === option.id}
                onClick={() => setCategory(option.id)}
              >
                <span aria-hidden>{option.emoji}</span>
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Qui a payé ?</p>
          <input type="hidden" name="payerId" value={payerId} />
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <Chip
                key={member.id}
                selected={payerId === member.id}
                onClick={() => setPayerId(member.id)}
              >
                <Avatar
                  id={member.id}
                  name={member.displayName}
                  color={member.avatarColor}
                  size="xs"
                />
                {member.id === currentUserId ? 'Moi' : member.displayName}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-muted">Partagé avec</p>
            <button
              type="button"
              onClick={() =>
                setParticipants(participants.length === members.length ? [] : allIds)
              }
              className="text-[13px] font-medium text-accent"
            >
              {participants.length === members.length ? 'Tout décocher' : 'Toute la coloc'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const selected = participants.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleParticipant(member.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition',
                    selected ? 'bg-accent-soft' : 'opacity-60',
                  )}
                >
                  <Avatar
                    id={member.id}
                    name={member.displayName}
                    color={member.avatarColor}
                    size="md"
                    muted={!selected}
                  />
                  <span className="max-w-[8ch] truncate text-[12px] text-muted">
                    {member.displayName}
                  </span>
                </button>
              );
            })}
          </div>
          {participants.map((id) => (
            <input key={id} type="hidden" name="participants" value={id} />
          ))}
        </div>

        <Field label="Date">
          <Input
            type="date"
            name="spentOn"
            defaultValue={expense?.spentOn ?? today()}
            max={today()}
          />
        </Field>

        <FormError>{error}</FormError>

        <div className="flex flex-col gap-2">
          <SubmitButton pendingLabel="Enregistrement…">
            {editing ? 'Enregistrer les modifications' : 'Ajouter la dépense'}
          </SubmitButton>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Participants pré-cochés d'une dépense à corriger.
 *
 * Les parts d'un ancien coloc survivent à son départ (`on delete restrict` sur
 * `expense_shares.user_id`) : les renvoyer telles quelles ferait échouer
 * l'enregistrement sur « Participant inconnu ». On ne garde que les membres
 * actuels, et une dépense qui ne concernait plus personne repart de toute la coloc.
 */
function initialParticipants(expense: Expense, memberIds: string[]): string[] {
  const known = new Set(memberIds);
  const kept = expense.shares.map((share) => share.userId).filter((id) => known.has(id));
  return kept.length > 0 ? kept : memberIds;
}
