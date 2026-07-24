'use client';

import { useEffect, useState } from 'react';

import {
  sendTestNotificationAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from '@/actions/push';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InstallHint } from '@/components/InstallHint';

type Status = 'loading' | 'unsupported' | 'off' | 'on' | 'denied';

/**
 * Abonnement Web Push.
 *
 * Sur iOS, `PushManager` n'existe que si l'app a été ajoutée à l'écran d'accueil :
 * on affiche alors la marche à suivre plutôt qu'un bouton qui ne peut pas marcher.
 */
export function NotificationsCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidPublicKey) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? 'on' : 'off'))
      .catch(() => setStatus('off'));
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const result = await subscribeToPushAction(
        JSON.parse(JSON.stringify(subscription)) as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        },
      );
      if (!result.ok) throw new Error(result.error);

      setStatus('on');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const result = await sendTestNotificationAction();
    setMessage(
      result.ok && result.data > 0
        ? 'Notification envoyée.'
        : 'Aucun appareil n’a reçu la notification.',
    );
    setBusy(false);
  }

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">Notifications</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Rappels de tâches, nouvelles dépenses partagées et remboursements reçus.
      </p>

      {status === 'unsupported' ? (
        <div className="mt-3">
          <InstallHint />
        </div>
      ) : status === 'denied' ? (
        <p className="mt-3 text-[13px] text-muted">
          Les notifications sont bloquées pour ce site. Réautorisez-les dans les réglages de votre
          navigateur.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {status === 'on' ? (
            <>
              <div className="flex items-center gap-2 text-[13px] font-medium text-positive">
                <span className="size-1.5 rounded-full bg-positive" aria-hidden />
                Activées sur cet appareil
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={busy} onClick={test}>
                  Tester
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={disable}>
                  Désactiver
                </Button>
              </div>
            </>
          ) : (
            <Button size="md" disabled={busy || status === 'loading'} onClick={enable}>
              {busy ? 'Activation…' : 'Activer les notifications'}
            </Button>
          )}
        </div>
      )}

      {message && <p className="mt-3 text-[13px] text-muted">{message}</p>}
    </Card>
  );
}

/** La clé VAPID publique voyage en base64url ; l'API push attend des octets. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
