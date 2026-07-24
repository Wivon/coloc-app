'use client';

import { useState, useTransition } from 'react';

import { rebalanceAction } from '@/actions/chores';
import { Button } from '@/components/ui/Button';

/**
 * Redistribue les échéances à venir. Utile après l'arrivée ou le départ d'un
 * coloc : les tâches déjà faites ne bougent pas.
 */
export function RebalanceButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Rééquilibrer
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await rebalanceAction();
            setConfirming(false);
          })
        }
      >
        {pending ? 'En cours…' : 'Confirmer'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Annuler
      </Button>
    </span>
  );
}
