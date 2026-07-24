import 'server-only';
import { after } from 'next/server';
import webpush from 'web-push';

import { db, unwrap } from '@/lib/db/client';
import { pushEnabled, serverEnv } from '@/lib/env';
import type { Uuid } from '@/lib/db/types';

export interface PushPayload {
  title: string;
  body: string;
  /** Chemin ouvert au clic sur la notification. */
  url?: string;
  /** Regroupe les notifications qui se remplacent (ex. rappel de tâches). */
  tag?: string;
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let configured = false;

function configure(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    const { vapid } = serverEnv();
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    configured = true;
  }
  return true;
}

export async function saveSubscription(
  userId: Uuid,
  subscription: BrowserSubscription,
  userAgent: string | null,
): Promise<void> {
  await db()
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
}

export async function removeSubscription(userId: Uuid, endpoint: string): Promise<void> {
  await db().from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}

export async function countSubscriptions(userId: Uuid): Promise<number> {
  const { count } = await db()
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

/**
 * Envoie une notification aux abonnements des utilisateurs donnés.
 *
 * Les envois sont indépendants : une erreur sur un appareil n'annule pas les
 * autres, et un abonnement expiré (404/410) est supprimé au passage. L'appelant
 * ne doit jamais échouer à cause d'une notification — d'où le `catch` global.
 */
export async function notifyUsers(userIds: Uuid[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0 || !configure()) return 0;

  const subscriptions = unwrap(
    await db()
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds),
  );

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db().from('push_subscriptions').delete().eq('id', row.id);
        }
        throw error;
      }
    }),
  );

  return results.filter((result) => result.status === 'fulfilled').length;
}

/**
 * Notifie après avoir répondu, sans jamais faire échouer l'action en cours.
 *
 * `after()` garde la tâche vivante au-delà de la réponse : un simple
 * `void promise` serait tué avec l'instance sur un hébergement serverless.
 */
export function notifyInBackground(userIds: Uuid[], payload: PushPayload): void {
  after(async () => {
    try {
      await notifyUsers(userIds, payload);
    } catch (error) {
      console.error('[push] envoi impossible', error);
    }
  });
}
