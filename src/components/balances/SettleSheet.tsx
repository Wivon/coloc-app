'use client';

import { useState } from 'react';

import { settleAction } from '@/actions/settlements';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, FormError, Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { centsToInput } from '@/lib/money';
import { useFormAction } from '@/lib/use-form-action';
import type { Transfer } from '@/lib/domain/balance-math';
import type { Member } from '@/lib/domain/households';

/**
 * Saisie manuelle d'un remboursement (virement hors de l'app, espèces…).
 * Monté uniquement quand la feuille est ouverte (voir `BalancesView`).
 */
export function SettleSheet({
  onClose,
  members,
  suggestions,
}: {
  onClose: () => void;
  members: Member[];
  /** Virements calculés, proposés en un tap. */
  suggestions: Transfer[];
}) {
  const [toUserId, setToUserId] = useState(members[0]?.id ?? '');
  const [amount, setAmount] = useState('');

  const { submit, error } = useFormAction(settleAction, onClose);

  if (members.length === 0) {
    return (
      <Sheet open onClose={onClose} title="Remboursement">
        <p className="text-[14px] text-muted">
          Vous êtes seul dans la colocation pour le moment.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
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

        <FormError>{error}</FormError>

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
