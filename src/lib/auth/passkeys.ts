import 'server-only';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';

import { db, unwrap } from '@/lib/db/client';
import { colorForId } from '@/lib/avatar';
import type { ChallengePurpose, UserRow, Uuid, WebauthnCredentialRow } from '@/lib/db/types';
import { CHALLENGE_TTL_MS, relyingParty, toTransports } from './webauthn';

/**
 * Inscription et connexion par passkey (WebAuthn), email en identifiant.
 *
 * Le client reçoit un `challengeId` avec les options et le renvoie à la
 * vérification : on retrouve ainsi le challenge exact sans ambiguïté si
 * plusieurs tentatives se chevauchent.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface OptionsResponse<T> {
  challengeId: Uuid;
  options: T;
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

export async function startRegistration(
  rawEmail: string,
  rawDisplayName: string,
): Promise<OptionsResponse<PublicKeyCredentialCreationOptionsJSON>> {
  const email = normalizeEmail(rawEmail);
  const displayName = rawDisplayName.trim();
  if (!isValidEmail(email)) throw new AuthError('Adresse email invalide.');
  if (displayName.length < 1) throw new AuthError('Indiquez votre prénom.');

  const existing = await findUserByEmail(email);
  if (existing && (await countCredentials(existing.id)) > 0) {
    throw new AuthError('Un compte existe déjà avec cet email. Connectez-vous.', 409);
  }

  const user = existing ?? (await insertUser(email, displayName));
  return buildRegistrationOptions(user);
}

/** Ajout d'une passkey supplémentaire pour un utilisateur déjà connecté. */
export async function startAddPasskey(
  user: UserRow,
): Promise<OptionsResponse<PublicKeyCredentialCreationOptionsJSON>> {
  return buildRegistrationOptions(user);
}

async function buildRegistrationOptions(
  user: UserRow,
): Promise<OptionsResponse<PublicKeyCredentialCreationOptionsJSON>> {
  const rp = relyingParty();
  const credentials = await listCredentials(user.id);

  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.display_name,
    attestationType: 'none',
    // Empêche d'enregistrer deux fois le même appareil.
    excludeCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: toTransports(credential.transports),
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const challengeId = await storeChallenge(options.challenge, 'registration', user.id, user.email);
  return { challengeId, options };
}

export async function finishRegistration(
  challengeId: Uuid,
  response: RegistrationResponseJSON,
): Promise<UserRow> {
  const challenge = await consumeChallenge(challengeId, 'registration');
  if (!challenge.user_id) throw new AuthError('Challenge invalide.');

  const rp = relyingParty();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AuthError("La passkey n'a pas pu être vérifiée.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const { error } = await db()
    .from('webauthn_credentials')
    .insert({
      id: credential.id,
      user_id: challenge.user_id,
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: response.response.transports ?? [],
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      nickname: null,
      last_used_at: new Date().toISOString(),
    });

  if (error) throw new AuthError('Cette passkey est déjà enregistrée.', 409);

  return getUser(challenge.user_id);
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export async function startLogin(
  rawEmail: string,
): Promise<OptionsResponse<PublicKeyCredentialRequestOptionsJSON>> {
  const email = normalizeEmail(rawEmail);
  const user = await findUserByEmail(email);
  const credentials = user ? await listCredentials(user.id) : [];

  if (!user || credentials.length === 0) {
    throw new AuthError('Aucun compte avec cet email. Créez-en un.', 404);
  }

  const options = await generateAuthenticationOptions({
    rpID: relyingParty().id,
    allowCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: toTransports(credential.transports),
    })),
    userVerification: 'preferred',
  });

  const challengeId = await storeChallenge(options.challenge, 'authentication', user.id, email);
  return { challengeId, options };
}

export async function finishLogin(
  challengeId: Uuid,
  response: AuthenticationResponseJSON,
): Promise<UserRow> {
  const challenge = await consumeChallenge(challengeId, 'authentication');

  const { data: credential } = await db()
    .from('webauthn_credentials')
    .select('*')
    .eq('id', response.id)
    .maybeSingle();

  if (!credential || credential.user_id !== challenge.user_id) {
    throw new AuthError('Passkey inconnue.', 404);
  }

  const rp = relyingParty();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    credential: {
      id: credential.id,
      publicKey: new Uint8Array(Buffer.from(credential.public_key, 'base64url')),
      counter: Number(credential.counter),
      transports: toTransports(credential.transports),
    },
    requireUserVerification: false,
  });

  if (!verification.verified) throw new AuthError('Authentification refusée.', 401);

  // Le compteur détecte le clonage d'authentificateur ; les passkeys synchronisées
  // renvoient souvent 0, ce qui reste valide.
  await db()
    .from('webauthn_credentials')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', credential.id);

  return getUser(credential.user_id);
}

// ---------------------------------------------------------------------------
// Gestion des passkeys
// ---------------------------------------------------------------------------

export async function listCredentials(userId: Uuid): Promise<WebauthnCredentialRow[]> {
  return unwrap(
    await db()
      .from('webauthn_credentials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  );
}

export async function deleteCredential(userId: Uuid, credentialId: string): Promise<void> {
  if ((await countCredentials(userId)) <= 1) {
    throw new AuthError('Gardez au moins une passkey pour pouvoir vous reconnecter.');
  }
  await db().from('webauthn_credentials').delete().eq('user_id', userId).eq('id', credentialId);
}

async function countCredentials(userId: Uuid): Promise<number> {
  const { count } = await db()
    .from('webauthn_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

async function storeChallenge(
  challenge: string,
  purpose: ChallengePurpose,
  userId: Uuid | null,
  email: string | null,
): Promise<Uuid> {
  const row = unwrap(
    await db()
      .from('webauthn_challenges')
      .insert({
        challenge,
        purpose,
        user_id: userId,
        email,
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      })
      .select('id')
      .single(),
  );
  return row.id;
}

/** Un challenge ne sert qu'une fois : il est supprimé dès sa lecture. */
async function consumeChallenge(challengeId: Uuid, purpose: ChallengePurpose) {
  const { data } = await db()
    .from('webauthn_challenges')
    .delete()
    .eq('id', challengeId)
    .eq('purpose', purpose)
    .select()
    .maybeSingle();

  if (!data) throw new AuthError('Session expirée, réessayez.', 410);
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new AuthError('Session expirée, réessayez.', 410);
  }
  return data;
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { data } = await db().from('users').select('*').eq('email', email).maybeSingle();
  return data ?? null;
}

async function insertUser(email: string, displayName: string): Promise<UserRow> {
  const id = crypto.randomUUID();
  return unwrap(
    await db()
      .from('users')
      .insert({ id, email, display_name: displayName, avatar_color: colorForId(id) })
      .select()
      .single(),
  );
}

async function getUser(userId: Uuid): Promise<UserRow> {
  return unwrap(await db().from('users').select('*').eq('id', userId).single());
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
