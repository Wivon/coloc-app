'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { db } from '@/lib/db/client';
import { destroySession } from '@/lib/auth/session';
import { isAvatarColor } from '@/lib/avatar';
import {
  createHousehold,
  joinHousehold,
  requireHouseholdContext,
  requireUser,
  setCurrentHousehold,
} from '@/lib/domain/households';
import { generateSchedule } from '@/lib/domain/chores';

export async function createHouseholdAction(formData: FormData): Promise<ActionResult<string>> {
  return attempt(async () => {
    const user = await requireUser();
    const name = String(formData.get('name') ?? '').trim();
    if (name.length < 2) throw new Error('Donnez un nom à votre colocation.');

    const household = await createHousehold(user.id, name);
    revalidatePath('/', 'layout');
    return household.id;
  });
}

export async function joinHouseholdAction(formData: FormData): Promise<ActionResult<string>> {
  return attempt(async () => {
    const user = await requireUser();
    const code = String(formData.get('inviteCode') ?? '');
    if (!code.trim()) throw new Error('Saisissez le code d’invitation.');

    const household = await joinHousehold(user.id, code);
    // Le nouvel arrivant doit entrer dans la rotation des tâches.
    await generateSchedule(household.id);
    revalidatePath('/', 'layout');
    return household.id;
  });
}

export async function switchHouseholdAction(householdId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const user = await requireUser();
    await setCurrentHousehold(user.id, householdId);
    revalidatePath('/', 'layout');
  });
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const user = await requireUser();
    const displayName = String(formData.get('displayName') ?? '').trim();
    const avatarColor = String(formData.get('avatarColor') ?? '');
    if (displayName.length < 1) throw new Error('Le prénom ne peut pas être vide.');

    await db()
      .from('users')
      .update({
        display_name: displayName,
        ...(isAvatarColor(avatarColor) ? { avatar_color: avatarColor } : {}),
      })
      .eq('id', user.id);

    revalidatePath('/', 'layout');
  });
}

export async function renameHouseholdAction(formData: FormData): Promise<ActionResult<void>> {
  return attempt(async () => {
    const { household } = await requireHouseholdContext();
    const name = String(formData.get('name') ?? '').trim();
    if (name.length < 2) throw new Error('Nom trop court.');

    await db().from('households').update({ name }).eq('id', household.id);
    revalidatePath('/', 'layout');
  });
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  revalidatePath('/', 'layout');
}
