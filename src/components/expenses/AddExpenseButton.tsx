'use client';

import { useState } from 'react';

import { AddExpenseSheet } from './AddExpenseSheet';
import { PlusButton } from '@/components/ui/PlusButton';
import type { Member } from '@/lib/domain/households';

export function AddExpenseButton({
  members,
  currentUserId,
  currency,
  defaultOpen = false,
}: {
  members: Member[];
  currentUserId: string;
  currency: string;
  /** Ouvert d'emblée via le raccourci `?new=1` de l'écran d'accueil. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <PlusButton label="Nouvelle dépense" onClick={() => setOpen(true)} />
      <AddExpenseSheet
        open={open}
        onClose={() => setOpen(false)}
        members={members}
        currentUserId={currentUserId}
        currency={currency}
      />
    </>
  );
}
