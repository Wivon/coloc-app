'use server';

import { revalidatePath } from 'next/cache';

import { attempt, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/domain/households';
import { mcpEndpointUrl, regenerateMcpToken } from '@/lib/domain/mcp-tokens';

/**
 * Remplace le lien MCP de l'utilisateur.
 *
 * À utiliser si le lien a fuité : l'ancien cesse de fonctionner immédiatement, et
 * l'assistant qui l'utilisait devra être reconfiguré avec le nouveau.
 */
export async function regenerateMcpLinkAction(): Promise<ActionResult<string>> {
  return attempt(async () => {
    const user = await requireUser();
    const url = mcpEndpointUrl(await regenerateMcpToken(user.id));
    revalidatePath('/settings');
    return url;
  });
}
