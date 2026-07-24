/*
 * Service worker de ColocApp.
 *
 * Volontairement limité aux notifications push : aucun cache n'est installé, donc
 * l'app ne peut pas servir une version périmée après un déploiement.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'ColocApp', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'ColocApp', {
      body: payload.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Un même `tag` remplace la notification précédente au lieu de s'empiler.
      tag: payload.tag,
      data: { url: payload.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Réutilise un onglet déjà ouvert plutôt que d'en empiler un nouveau.
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('navigate' in client) return client.navigate(target).then((c) => c?.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
