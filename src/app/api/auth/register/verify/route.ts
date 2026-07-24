import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { finishRegistration } from '@/lib/auth/passkeys';
import { createSession } from '@/lib/auth/session';
import { jsonRoute } from '@/lib/http';

export const POST = jsonRoute<{ challengeId: string; response: RegistrationResponseJSON }>(
  async ({ challengeId, response }) => {
    const user = await finishRegistration(challengeId, response);
    await createSession(user.id);
    return { userId: user.id };
  },
);
