'use server';

import { headers } from 'next/headers';

import { attempt, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/domain/households';
import {
  notifyUsers,
  removeSubscription,
  saveSubscription,
  type BrowserSubscription,
} from '@/lib/domain/push';

export async function subscribeToPushAction(
  subscription: BrowserSubscription,
): Promise<ActionResult<void>> {
  return attempt(async () => {
    const user = await requireUser();
    const userAgent = (await headers()).get('user-agent');
    await saveSubscription(user.id, subscription, userAgent);
  });
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const user = await requireUser();
    await removeSubscription(user.id, endpoint);
  });
}

export async function sendTestNotificationAction(): Promise<ActionResult<number>> {
  return attempt(async () => {
    const user = await requireUser();
    return notifyUsers([user.id], {
      title: 'ColocApp',
      body: 'Les notifications fonctionnent 🎉',
      url: '/tasks',
      tag: 'test',
    });
  });
}
