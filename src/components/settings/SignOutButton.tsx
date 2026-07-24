'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { signOutAction } from '@/actions/household';
import { Button } from '@/components/ui/Button';

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          router.replace('/login');
        })
      }
    >
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </Button>
  );
}
