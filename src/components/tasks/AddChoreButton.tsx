'use client';

import { useState } from 'react';

import { AddChoreSheet } from './AddChoreSheet';
import { PlusButton } from '@/components/ui/PlusButton';

export function AddChoreButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PlusButton label="Nouvelle tâche" onClick={() => setOpen(true)} />
      <AddChoreSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
