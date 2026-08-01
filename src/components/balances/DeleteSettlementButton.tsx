'use client';

import { useState, useTransition } from 'react';

import { deleteSettlementAction } from '@/actions/settlements';
import { Button } from '@/components/ui/Button';

/**
 * Annule un remboursement enregistré par erreur.
 *
 * Un remboursement ne se corrige pas autrement : il n'est pas modifiable, et tant
 * qu'il est là il fausse le solde des deux colocs concernés. Confirmation en deux
 * temps, comme pour la suppression d'une dépense.
 */
export function DeleteSettlementButton({ settlementId }: { settlementId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label="Annuler ce remboursement"
        onClick={() => setConfirming(true)}
      >
        Annuler
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {error ? <span className="text-[12.5px] text-negative">{error}</span> : null}
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteSettlementAction(settlementId);
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? '…' : 'Confirmer'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Non
      </Button>
    </span>
  );
}
