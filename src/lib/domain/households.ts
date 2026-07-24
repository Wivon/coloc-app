import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';

import { readSessionUserId } from '@/lib/auth/session';
import { db, unwrap } from '@/lib/db/client';
import type { HouseholdRow, MemberRole, UserRow, Uuid } from '@/lib/db/types';

export interface Member {
  id: Uuid;
  displayName: string;
  email: string;
  avatarColor: string;
  role: MemberRole;
}

export interface HouseholdContext {
  user: UserRow;
  household: HouseholdRow;
  members: Member[];
}

/**
 * Utilisateur connecté, ou `null`. Ne redirige pas — utile sur les pages publiques.
 *
 * `cache()` déduplique l'appel : la mise en page et la page peuvent tous deux
 * demander le contexte sans multiplier les requêtes.
 */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const { data } = await db().from('users').select('*').eq('id', userId).maybeSingle();
  return data ?? null;
});

export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Contexte complet d'une page de l'app : utilisateur, colocation courante et
 * membres. Redirige vers `/onboarding` tant que l'utilisateur n'a pas de coloc.
 *
 * C'est le seul point d'entrée des pages authentifiées : passer par ici garantit
 * que l'appartenance à la colocation a été vérifiée.
 */
export const requireHouseholdContext = cache(async (): Promise<HouseholdContext> => {
  const user = await requireUser();
  const household = await resolveHousehold(user);
  if (!household) redirect('/onboarding');

  return { user, household, members: await listMembers(household.id) };
});

async function resolveHousehold(user: UserRow): Promise<HouseholdRow | null> {
  if (user.current_household_id) {
    const { data } = await db()
      .from('household_members')
      .select('households(*)')
      .eq('user_id', user.id)
      .eq('household_id', user.current_household_id)
      .maybeSingle<{ households: HouseholdRow }>();
    if (data?.households) return data.households;
  }

  // Le pointeur est vide ou périmé : on retombe sur la première coloc rejointe.
  const { data } = await db()
    .from('household_members')
    .select('households(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ households: HouseholdRow }>();

  if (!data?.households) return null;
  await setCurrentHousehold(user.id, data.households.id);
  return data.households;
}

export async function hasHousehold(userId: Uuid): Promise<boolean> {
  const { count } = await db()
    .from('household_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}

export async function listMembers(householdId: Uuid): Promise<Member[]> {
  const rows = unwrap(
    await db()
      .from('household_members')
      .select('role, users(id, display_name, email, avatar_color)')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true })
      .returns<{ role: MemberRole; users: Pick<UserRow, 'id' | 'display_name' | 'email' | 'avatar_color'> }[]>(),
  );

  return rows.map((row) => ({
    id: row.users.id,
    displayName: row.users.display_name,
    email: row.users.email,
    avatarColor: row.users.avatar_color,
    role: row.role,
  }));
}

/** Lève une erreur si l'utilisateur n'appartient pas à la colocation. */
export async function assertMembership(userId: Uuid, householdId: Uuid): Promise<void> {
  const { data } = await db()
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) throw new Error("Vous n'appartenez pas à cette colocation.");
}

export async function setCurrentHousehold(userId: Uuid, householdId: Uuid): Promise<void> {
  await db().from('users').update({ current_household_id: householdId }).eq('id', userId);
}

export async function createHousehold(userId: Uuid, name: string): Promise<HouseholdRow> {
  const household = unwrap(
    await db()
      .from('households')
      .insert({ name, invite_code: generateInviteCode(), created_by: userId, currency: 'EUR' })
      .select()
      .single(),
  );

  await db()
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, role: 'owner' });
  await setCurrentHousehold(userId, household.id);

  return household;
}

export async function joinHousehold(userId: Uuid, inviteCode: string): Promise<HouseholdRow> {
  const { data: household } = await db()
    .from('households')
    .select('*')
    .eq('invite_code', normalizeInviteCode(inviteCode))
    .maybeSingle();

  if (!household) throw new Error('Code d’invitation introuvable.');

  await db()
    .from('household_members')
    .upsert(
      { household_id: household.id, user_id: userId, role: 'member' },
      { onConflict: 'household_id,user_id' },
    );
  await setCurrentHousehold(userId, household.id);

  return household;
}

/** Code court sans caractères ambigus (0/O, 1/I). */
function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s|-/g, '');
}
