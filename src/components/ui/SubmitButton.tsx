'use client';

import { useFormStatus } from 'react-dom';

import { Button } from './Button';

/** Bouton de soumission qui reflète l'état du formulaire parent. */
export function SubmitButton({
  children,
  pendingLabel = 'Un instant…',
  variant = 'primary',
  size = 'lg',
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
