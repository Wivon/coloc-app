import 'server-only';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

import { serverEnv } from '@/lib/env';

/**
 * Paramètres de la « Relying Party » WebAuthn.
 *
 * Le `rpID` doit être le domaine exact servant l'app (sans protocole ni port) :
 * une passkey enregistrée sur `localhost` ne fonctionnera pas sur le domaine de
 * production, et inversement.
 */
export function relyingParty() {
  const origin = serverEnv().appUrl;
  return {
    name: 'ColocApp',
    id: new URL(origin).hostname,
    origin,
  };
}

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Les `transports` stockés en base sont du `text[]` générique. */
export function toTransports(values: string[] | null): AuthenticatorTransportFuture[] | undefined {
  return values?.length ? (values as AuthenticatorTransportFuture[]) : undefined;
}
