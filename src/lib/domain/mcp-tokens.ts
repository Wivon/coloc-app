import 'server-only';
import { after } from 'next/server';

import { db, unwrap } from '@/lib/db/client';
import { serverEnv } from '@/lib/env';
import type { HouseholdRow, McpTokenRow, UserRow, Uuid } from '@/lib/db/types';
import { listMembers, resolveHousehold, type Member } from './households';

/**
 * Jeton d'endpoint MCP personnel.
 *
 * Un connecteur MCP distant appelle l'app depuis l'infrastructure de l'assistant,
 * sans cookie ni passkey : le jeton porté par l'URL est donc la seule preuve
 * d'identité. Il est tiré sur 32 octets aléatoires — deviner un lien est hors de
 * portée — et « Régénérer » invalide l'ancien immédiatement.
 *
 * Le jeton donne accès à **une personne**, pas à une colocation : les outils
 * agissent toujours au nom de son porteur, dans la coloc où il se trouve.
 */

const TOKEN_BYTES = 32;
const PREFIX = 'mcp_';

export interface McpIdentity {
  user: UserRow;
  household: HouseholdRow;
  members: Member[];
}

/** Lien à coller dans les réglages de l'assistant. */
export function mcpEndpointUrl(token: string): string {
  return `${serverEnv().appUrl}/api/mcp/${token}`;
}

/** Jeton de l'utilisateur, créé au premier affichage de l'écran de réglages. */
export async function getOrCreateMcpToken(userId: Uuid): Promise<string> {
  const { data } = await db()
    .from('mcp_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle<Pick<McpTokenRow, 'token'>>();

  if (data) return data.token;

  // `upsert` plutôt qu'`insert` : deux onglets ouverts en même temps ne doivent
  // pas faire échouer l'affichage sur un conflit de clé primaire.
  const row = unwrap(
    await db()
      .from('mcp_tokens')
      .upsert({ user_id: userId, token: generateToken() }, { onConflict: 'user_id' })
      .select('token')
      .single(),
  );

  return row.token;
}

/** Remplace le jeton : l'ancien lien cesse aussitôt de fonctionner. */
export async function regenerateMcpToken(userId: Uuid): Promise<string> {
  const row = unwrap(
    await db()
      .from('mcp_tokens')
      .upsert(
        { user_id: userId, token: generateToken(), last_used_at: null },
        { onConflict: 'user_id' },
      )
      .select('token')
      .single(),
  );

  return row.token;
}

/**
 * Identité derrière un jeton, ou `null` s'il est inconnu — ou si son porteur n'a
 * pas (ou plus) de colocation, auquel cas il n'y a rien à faire côté MCP.
 */
export async function resolveMcpToken(token: string): Promise<McpIdentity | null> {
  if (!token.startsWith(PREFIX)) return null;

  const { data } = await db()
    .from('mcp_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle<Pick<McpTokenRow, 'user_id'>>();
  if (!data) return null;

  const { data: user } = await db().from('users').select('*').eq('id', data.user_id).maybeSingle();
  if (!user) return null;

  const household = await resolveHousehold(user);
  if (!household) return null;

  // Après la réponse : la trace d'usage ne doit rien coûter à l'appel.
  after(() =>
    db()
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', user.id),
  );

  return { user, household, members: await listMembers(household.id) };
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return PREFIX + base64url(bytes);
}

/** base64url sans dépendance : le jeton voyage dans un chemin d'URL. */
function base64url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
