'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deletePasskeyAction } from '@/actions/passkeys';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { addPasskey, describeAuthError } from '@/lib/auth/client';
import { formatShortDate } from '@/lib/date';

export interface PasskeySummary {
  id: string;
  deviceType: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeysCard({ passkeys }: { passkeys: PasskeySummary[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addPasskey();
      router.refresh();
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePasskeyAction(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">Passkeys</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Ajoutez-en une par appareil pour vous connecter partout sans mot de passe.
      </p>

      <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
        {passkeys.map((passkey) => (
          <li key={passkey.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] text-ink">
                {passkey.deviceType === 'multiDevice' ? 'Passkey synchronisée' : 'Cet appareil'}
              </span>
              <span className="block text-[12.5px] text-subtle">
                Ajoutée le {formatShortDate(passkey.createdAt.slice(0, 10))}
                {passkey.lastUsedAt
                  ? ` · utilisée le ${formatShortDate(passkey.lastUsedAt.slice(0, 10))}`
                  : ''}
              </span>
            </span>
            {passkeys.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => remove(passkey.id)}>
                Retirer
              </Button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}

      <Button variant="secondary" size="md" className="mt-4" disabled={busy} onClick={add}>
        {busy ? 'En cours…' : 'Ajouter une passkey'}
      </Button>
    </Card>
  );
}
