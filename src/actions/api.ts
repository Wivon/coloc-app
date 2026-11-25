'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/domain/households';
import { regenerateApiToken } from '@/lib/domain/api-tokens';

/**
 * Remplace le jeton d'API de l'utilisateur. L'ancien cesse de fonctionner
 * immédiatement : les scripts qui l'utilisaient devront recevoir le nouveau.
 */
export async function regenerateApiTokenAction(): Promise<ActionResult<string>> {
  return attempt(async () => {
    const user = await requireUser();
    const token = await regenerateApiToken(user.id);
    revalidatePath('/settings');
    return token;
  });
}
