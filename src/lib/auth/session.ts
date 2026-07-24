import 'server-only';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

import { serverEnv } from '@/lib/env';
import type { Uuid } from '@/lib/db/types';

const COOKIE_NAME = 'coloc_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 jours
const ISSUER = 'colocapp';

function secret(): Uint8Array {
  return new TextEncoder().encode(serverEnv().authSecret);
}

/**
 * Session sans état : un JWT signé stocké dans un cookie httpOnly.
 *
 * Pas de table `sessions` — si le besoin de révocation apparaît, ajouter un
 * identifiant de session dans le payload et le vérifier ici.
 */
export async function createSession(userId: Uuid): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Identifiant de l'utilisateur connecté, ou `null` si le cookie est absent/invalide. */
export async function readSessionUserId(): Promise<Uuid | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
