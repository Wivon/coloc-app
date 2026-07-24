'use client';

import { useActionState, useEffect, useState } from 'react';

import { addExpenseAction } from '@/actions/expenses';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { formatMoney, parseAmountToCents, splitEvenly } from '@/lib/money';
import type { ActionResult } from '@/lib/action-result';
import type { Member } from '@/lib/domain/households';

const initial: ActionResult<void> | null = null;

export function AddExpenseSheet({
  open,
  onClose,
  members,
  currentUserId,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  currentUserId: string;
  currency: string;
}) {
  const allIds = members.map((member) => member.id);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('courses');
  const [payerId, setPayerId] = useState(currentUserId);
  // Par défaut, tout le monde partage.
  const [participants, setParticipants] = useState<string[]>(allIds);

  const [state, submit] = useActionState(
    (_state: typeof initial, formData: FormData) => addExpenseAction(formData),
    initial,
  );

  useEffect(() => {
    if (!state?.ok) return;
    // Formulaire remis à zéro pour la prochaine dépense.
    setAmount('');
    setParticipants(members.map((member) => member.id));
    setPayerId(currentUserId);
    onClose();
  }, [state, onClose, currentUserId, members]);

  const amountCents = parseAmountToCents(amount) ?? 0;
  const shareCents =
    participants.length > 0 ? splitEvenly(amountCents, participants.length)[0] : 0;

  function toggleParticipant(id: string) {
    setParticipants((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle dépense">
      <form action={submit} className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-1 pb-1">
          <div className="flex items-baseline gap-1">
            <input
              name="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              autoFocus
              required
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
          <Input name="description" placeholder="Courses de la semaine" required />
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
          <Input type="date" name="spentOn" defaultValue={today()} max={today()} />
        </Field>

        {!state?.ok && <FormError>{state?.error}</FormError>}

        <div className="flex flex-col gap-2">
          <SubmitButton pendingLabel="Enregistrement…">Ajouter la dépense</SubmitButton>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
