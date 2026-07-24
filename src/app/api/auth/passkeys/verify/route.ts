import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { AuthError, finishRegistration } from '@/lib/auth/passkeys';
import { getCurrentUser } from '@/lib/domain/households';
import { jsonRoute } from '@/lib/http';

export const POST = jsonRoute<{ challengeId: string; response: RegistrationResponseJSON }>(
  async ({ challengeId, response }) => {
    const user = await getCurrentUser();
    if (!user) throw new AuthError('Vous devez être connecté.', 401);

    const owner = await finishRegistration(challengeId, response);
    if (owner.id !== user.id) throw new AuthError('Passkey rattachée à un autre compte.', 403);
    return { ok: true };
  },
);
