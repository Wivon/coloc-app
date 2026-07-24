import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

import { finishLogin } from '@/lib/auth/passkeys';
import { createSession } from '@/lib/auth/session';
import { jsonRoute } from '@/lib/http';

export const POST = jsonRoute<{ challengeId: string; response: AuthenticationResponseJSON }>(
  async ({ challengeId, response }) => {
    const user = await finishLogin(challengeId, response);
    await createSession(user.id);
    return { userId: user.id };
  },
);
