'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Copie dans le presse-papiers avec un retour « Copié » de deux secondes.
 *
 * `copy` renvoie `false` quand le navigateur refuse (contexte non sécurisé,
 * permission) : à l'appelant d'afficher alors la valeur pour une copie manuelle.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(value: string, key = value): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return false;
    }
    setCopied(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
    return true;
  }

  /** Clé de la dernière copie réussie encore affichée comme « Copié ». */
  return { copy, copied, reset: () => setCopied(null) };
}
