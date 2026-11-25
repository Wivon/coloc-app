import 'server-only';
import { after } from 'next/server';

import { db, unwrap } from '@/lib/db/client';
import { serverEnv } from '@/lib/env';
import { randomToken } from '@/lib/random-token';
import type { ApiTokenRow, Uuid } from '@/lib/db/types';
import { listMembers, resolveHousehold, type HouseholdContext } from './households';

/**
 * Jeton d'API personnelle : `Authorization: Bearer coloc_…` sur `/api/v1/*`.
 *
 * Même modèle que le lien MCP (voir `mcp-tokens.ts`) — un jeton par personne,
 * réaffichable, révocable d'un geste — mais distinct de lui : chaque accès se
 * révoque sans casser l'autre.
 *
 * 24 octets aléatoires, soit 192 bits : un jeton court à copier, toujours très
 * au-delà de ce qu'on peut deviner.
 */

const TOKEN_BYTES = 24;
const PREFIX = 'coloc_';

/** Racine de l'API, à afficher à côté du jeton. */
export function apiBaseUrl(): string {
  return `${serverEnv().appUrl}/api/v1`;
}

/** Jeton de l'utilisateur, créé au premier affichage de l'écran de réglages. */
export async function getOrCreateApiToken(userId: Uuid): Promise<string> {
  const { data } = await db()
    .from('api_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle<Pick<ApiTokenRow, 'token'>>();

  if (data) return data.token;

  // `upsert` : deux onglets ouverts en même temps ne doivent pas échouer sur un
  // conflit de clé primaire.
  const row = unwrap(
    await db()
      .from('api_tokens')
      .upsert({ user_id: userId, token: randomToken(PREFIX, TOKEN_BYTES) }, { onConflict: 'user_id' })
      .select('token')
      .single(),
  );

  return row.token;
}

/** Remplace le jeton : l'ancien cesse aussitôt de fonctionner. */
export async function regenerateApiToken(userId: Uuid): Promise<string> {
  const row = unwrap(
    await db()
      .from('api_tokens')
      .upsert(
        { user_id: userId, token: randomToken(PREFIX, TOKEN_BYTES), last_used_at: null },
        { onConflict: 'user_id' },
      )
      .select('token')
      .single(),
  );

  return row.token;
}

/**
 * Identité derrière un jeton, ou `null` s'il est inconnu — ou si son porteur n'a
 * pas (ou plus) de colocation : il n'y aurait alors rien à lire.
 */
export async function resolveApiToken(token: string): Promise<HouseholdContext | null> {
  if (!token.startsWith(PREFIX)) return null;

  const { data } = await db()
    .from('api_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle<Pick<ApiTokenRow, 'user_id'>>();
  if (!data) return null;

  const { data: user } = await db().from('users').select('*').eq('id', data.user_id).maybeSingle();
  if (!user) return null;

  const household = await resolveHousehold(user);
  if (!household) return null;

  // Après la réponse : la trace d'usage ne doit rien coûter à l'appel.
  after(() =>
    db()
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', user.id),
  );

  return { user, household, members: await listMembers(household.id) };
}
