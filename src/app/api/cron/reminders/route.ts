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
      .select('assignee_id, due_on, chores(title, emoji)')
      .is('completed_at', null)
      .lte('due_on', today())
      .returns<{ assignee_id: Uuid; due_on: string; chores: Pick<ChoreRow, 'title' | 'emoji'> }[]>(),
  );

  const byUser = new Map<Uuid, { titles: string[]; late: number }>();
  for (const row of due) {
    const entry = byUser.get(row.assignee_id) ?? { titles: [], late: 0 };
    entry.titles.push(`${row.chores.emoji} ${row.chores.title}`);
    if (row.due_on < today()) entry.late += 1;
    byUser.set(row.assignee_id, entry);
  }

  let sent = 0;
  for (const [userId, entry] of byUser) {
    sent += await notifyUsers([userId], {
      title: entry.titles.length === 1 ? 'Une tâche t’attend' : `${entry.titles.length} tâches t’attendent`,
      body:
        entry.titles.slice(0, 3).join(' · ') +
        (entry.late > 0 ? ` — ${entry.late} en retard` : ''),
      url: '/tasks',
      tag: 'daily-reminder',
    });
  }

  await db().rpc('delete_expired_webauthn_challenges');

  return NextResponse.json({ users: byUser.size, notifications: sent });
}
