'use client';

import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-3xl" aria-hidden>
        🫠
      </span>
      <h1 className="text-[20px] font-semibold text-ink">Quelque chose a coincé</h1>
      <p className="text-[14px] text-muted">
        L’action n’a pas pu aboutir. Réessayez : vos données sont intactes.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
