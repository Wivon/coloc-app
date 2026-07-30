import { NextResponse } from 'next/server';

import { db, unwrap } from '@/lib/db/client';
import { serverEnv } from '@/lib/env';
import { today } from '@/lib/date';
import { notifyUsers } from '@/lib/domain/push';
import type { ChoreRow, Uuid } from '@/lib/db/types';

/**
 * Rappel quotidien des tâches du jour et en retard.
 *
 * À déclencher une fois par jour (cron Vercel, ou `curl` avec l'en-tête
 * `Authorization: Bearer $CRON_SECRET`).
 */
export async function GET(request: Request) {
  const secret = serverEnv().cronSecret;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const due = unwrap(
    await db()
      .from('chore_assignments')
      .select('assignee_id, chores(title, emoji)')
      .is('completed_at', null)
      .lte('due_on', today())
      .returns<{ assignee_id: Uuid; chores: Pick<ChoreRow, 'title' | 'emoji'> }[]>(),
  );

  const byUser = new Map<Uuid, string[]>();
  for (const row of due) {
    const titles = byUser.get(row.assignee_id) ?? [];
    titles.push(`${row.chores.emoji} ${row.chores.title}`);
    byUser.set(row.assignee_id, titles);
  }

  let sent = 0;
  for (const [userId, titles] of byUser) {
    sent += await notifyUsers([userId], {
      title: 'Tâches pour aujourd’hui',
      body: titles.join(', '),
      url: '/tasks',
      tag: 'daily-reminder',
    });
  }

  await db().rpc('delete_expired_webauthn_challenges');

  return NextResponse.json({ users: byUser.size, notifications: sent });
}
