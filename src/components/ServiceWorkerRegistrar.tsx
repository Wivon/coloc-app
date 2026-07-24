'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker au chargement. Il ne sert qu'aux notifications
 * push : pas de cache hors-ligne, donc aucun risque de servir une version périmée.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error) => console.error('[sw] enregistrement impossible', error));
  }, []);

  return null;
}
