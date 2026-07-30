'use client';

import { useState } from 'react';

import { AddChoreSheet } from './AddChoreSheet';
import { PlusButton } from '@/components/ui/PlusButton';

export function AddChoreButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PlusButton label="Nouvelle tâche" onClick={() => setOpen(true)} />
      {/* Montage conditionnel : la feuille repart d'un état vierge à chaque
          ouverture, et aucun état de soumission ne peut survivre à sa fermeture. */}
      {open ? <AddChoreSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
