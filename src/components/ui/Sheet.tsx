'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Feuille modale ancrée en bas d'écran — le geste attendu sur mobile, et centrée
 * en boîte de dialogue au-dessus de 640px.
 *
 * Rendue dans un portail vers `document.body` : les déclencheurs vivent souvent
 * dans l'en-tête collant, dont le `backdrop-filter` crée un bloc conteneur pour
 * les descendants `position: fixed`. Sans portail, la feuille se calerait sur
 * l'en-tête au lieu du viewport.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  // `document` n'existe pas au rendu serveur : on attend le montage client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // `onClose` est presque toujours une lambda inline côté appelant, donc son
  // identité change à chaque rendu du parent. La garder hors des dépendances
  // évite de reposer le listener et de rejouer le verrou de défilement.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    // Empêche la page de défiler derrière la feuille.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/35 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-in relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface sm:max-w-[440px] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3 pt-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 rounded-full p-2 text-subtle transition hover:bg-sunken hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="safe-bottom overflow-y-auto px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
