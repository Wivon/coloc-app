import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ColocApp — tâches & dépenses',
    short_name: 'ColocApp',
    description: 'Tâches, dépenses et comptes de colocation, au même endroit.',
    // L'app s'ouvre sur les tâches ; la redirection renvoie vers la connexion si besoin.
    start_url: '/tasks',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfaf8',
    theme_color: '#0f7b6c',
    lang: 'fr',
    dir: 'ltr',
    categories: ['productivity', 'finance', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Ajouter une dépense', url: '/expenses?new=1' },
      { name: 'Mes tâches', url: '/tasks' },
      { name: 'Régler mes comptes', url: '/balances' },
    ],
  };
}
