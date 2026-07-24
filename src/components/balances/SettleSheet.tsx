'use client';

import { useActionState, useEffect, useState } from 'react';

import { settleAction } from '@/actions/settlements';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { centsToInput } from '@/lib/money';
import type { ActionResult } from '@/lib/action-result';
import type { Transfer } from '@/lib/domain/balance-math';
import type { Member } from '@/lib/domain/households';

const initial: ActionResult<void> | null = null;

/** Saisie manuelle d'un remboursement (virement fait hors de l'app, espèces…). */
export function SettleSheet({
  open,
  onClose,
  members,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  /** Virements calculés, proposés en un tap. */
  suggestions: Transfer[];
}) {
  const [toUserId, setToUserId] = useState(members[0]?.id ?? '');
  const [amount, setAmount] = useState('');

  const [state, submit] = useActionState(
    (_state: typeof initial, formData: FormData) => settleAction(formData),
    initial,
  );

  useEffect(() => {
    if (state?.ok) {
      setAmount('');
      onClose();
    }
  }, [state, onClose]);

  if (members.length === 0) {
    return (
      <Sheet open={open} onClose={onClose} title="Remboursement">
        <p className="text-[14px] text-muted">
          Vous êtes seul dans la colocation pour le moment.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="J’ai remboursé"
      description="Le montant est déduit de ton solde, rien n’est supprimé de l’historique."
    >
      <form action={submit} className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">À qui ?</p>
          <input type="hidden" name="toUserId" value={toUserId} />
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <Chip
                key={member.id}
                selected={toUserId === member.id}
                onClick={() => {
                  setToUserId(member.id);
                  const suggestion = suggestions.find(
                    (transfer) => transfer.toUserId === member.id,
                  );
                  if (suggestion) setAmount(centsToInput(suggestion.amountCents));
                }}
              >
                <Avatar
                  id={member.id}
                  name={member.displayName}
                  color={member.avatarColor}
                  size="xs"
                />
                {member.displayName}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Montant">
          <Input
            name="amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            required
            className="text-[20px] font-medium tabular"
          />
        </Field>

        <Field label="Note" hint="Facultatif — « virement », « en liquide »…">
          <Input name="note" placeholder="Virement" maxLength={80} />
        </Field>

        {!state?.ok && <FormError>{state?.error}</FormError>}

        <div className="flex flex-col gap-2">
          <SubmitButton pendingLabel="Enregistrement…">
            Enregistrer le remboursement
          </SubmitButton>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
