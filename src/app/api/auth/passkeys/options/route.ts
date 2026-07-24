import { AuthError, startAddPasskey } from '@/lib/auth/passkeys';
import { getCurrentUser } from '@/lib/domain/households';
import { jsonRoute } from '@/lib/http';

/** Enregistre une passkey supplémentaire (autre appareil) pour le compte connecté. */
export const POST = jsonRoute(async () => {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Vous devez être connecté.', 401);
  return startAddPasskey(user);
});
