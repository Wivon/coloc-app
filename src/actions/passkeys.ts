'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { deleteCredential } from '@/lib/auth/passkeys';
import { requireUser } from '@/lib/domain/households';

export async function deletePasskeyAction(credentialId: string): Promise<ActionResult<void>> {
  return attempt(async () => {
    const user = await requireUser();
    await deleteCredential(user.id, credentialId);
    revalidatePath('/settings');
  });
}
