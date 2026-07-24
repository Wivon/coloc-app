'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/** Code d'invitation, avec partage natif sur mobile et copie ailleurs. */
export function InviteCard({ inviteCode, householdName }: { inviteCode: string; householdName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = `Rejoins « ${householdName} » sur ColocApp avec le code ${inviteCode}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'ColocApp', text });
        return;
      } catch {
        // Partage annulé : on retombe sur la copie.
      }
    }

    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">Inviter un coloc</h2>
      <p className="mt-1 text-[13px] text-muted">
        Il saisira ce code au moment de créer son compte.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <code className="flex-1 rounded-xl bg-sunken py-3 text-center text-[22px] font-semibold tracking-[0.25em] text-ink">
          {inviteCode}
        </code>
        <Button variant="secondary" size="md" onClick={share}>
          {copied ? 'Copié' : 'Partager'}
        </Button>
      </div>
    </Card>
  );
}
