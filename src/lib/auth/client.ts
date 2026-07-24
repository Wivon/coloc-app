'use client';

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

/**
 * Cérémonies WebAuthn côté navigateur.
 *
 * Le serveur renvoie `{ challengeId, options }` ; on renvoie le `challengeId`
 * avec la réponse de l'authentificateur pour que le serveur retrouve exactement
 * le challenge émis.
 */

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? 'Une erreur est survenue.');
  return payload as T;
}

export async function signUpWithPasskey(email: string, displayName: string): Promise<void> {
  const { challengeId, options } = await post<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/api/auth/register/options', { email, displayName });

  const response = await startRegistration({ optionsJSON: options });
  await post('/api/auth/register/verify', { challengeId, response });
}

export async function signInWithPasskey(email: string): Promise<void> {
  const { challengeId, options } = await post<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>('/api/auth/login/options', { email });

  const response = await startAuthentication({ optionsJSON: options });
  await post('/api/auth/login/verify', { challengeId, response });
}

/** Ajoute une passkey (nouvel appareil) au compte déjà connecté. */
export async function addPasskey(): Promise<void> {
  const { challengeId, options } = await post<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/api/auth/passkeys/options', {});

  const response = await startRegistration({ optionsJSON: options });
  await post('/api/auth/passkeys/verify', { challengeId, response });
}

/**
 * Traduit les erreurs de l'API WebAuthn en messages lisibles. Une annulation
 * utilisateur ne doit pas ressembler à un bug.
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') return 'Demande annulée. Réessayez quand vous voulez.';
    if (error.name === 'InvalidStateError') {
      return 'Cet appareil a déjà une passkey pour ce compte. Connectez-vous.';
    }
    if (error.name === 'SecurityError') {
      return 'Domaine non autorisé pour les passkeys. Vérifiez NEXT_PUBLIC_APP_URL.';
    }
    return error.message;
  }
  return 'Une erreur est survenue.';
}
