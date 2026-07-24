'use client';

import { useState, useTransition } from 'react';

import { deleteChoreAction } from '@/actions/chores';
import { Button } from '@/components/ui/Button';

/**
 * Arrête une tâche récurrente.
 *
 * Les échéances à venir non faites disparaissent, l'historique déjà coché reste
 * intact — les statistiques d'équilibre ne sont donc pas réécrites. La
 * confirmation est en deux temps : le bouton est à portée de pouce dans une
 * feuille qu'on ouvre surtout pour réattribuer.
 */
export function DeleteChoreButton({
  choreId,
  onDeleted,
}: {
  choreId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="danger" size="lg" onClick={() => setConfirming(true)}>
        Arrêter cette tâche
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-sunken p-3">
      <p className="text-[13px] leading-relaxed text-muted">
        Les échéances à venir seront retirées. Ce qui a déjà été fait reste dans l’historique.
      </p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="md"
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteChoreAction(choreId);
              if (result.ok) onDeleted();
            })
          }
        >
          {pending ? 'Suppression…' : 'Confirmer'}
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
