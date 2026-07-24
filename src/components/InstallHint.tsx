'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Invite à installer l'app sur l'écran d'accueil.
 *
 * C'est une étape obligatoire sur iOS : Safari n'autorise les notifications push
 * que pour une PWA installée. Masqué dès que l'app tourne en mode `standalone`.
 */
export function InstallHint({ className }: { className?: string }) {
  const [state, setState] = useState<'hidden' | 'ios' | 'other'>('hidden');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari iOS n'expose pas `display-mode` avant l'installation.
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setState(isIOS ? 'ios' : 'other');
  }, []);

  if (state === 'hidden') return null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted',
        className,
      )}
    >
      {state === 'ios' ? (
        <>
          <span className="font-medium text-ink">Installez ColocApp</span> — appuyez sur{' '}
          <ShareGlyph /> puis « Sur l’écran d’accueil ». Indispensable pour recevoir les
          notifications sur iPhone.
        </>
      ) : (
        <>
          <span className="font-medium text-ink">Installez ColocApp</span> depuis le menu de votre
          navigateur pour l’ouvrir comme une vraie app.
        </>
      )}
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Partager"
      role="img"
      className="mx-0.5 inline size-[15px] -translate-y-px"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M8.5 6.5L12 3l3.5 3.5" />
      <path d="M6 11H4.5v9.5h15V11H18" />
    </svg>
  );
}
