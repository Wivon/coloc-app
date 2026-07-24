import { startRegistration } from '@/lib/auth/passkeys';
import { jsonRoute } from '@/lib/http';

export const POST = jsonRoute<{ email: string; displayName: string }>(({ email, displayName }) =>
  startRegistration(email ?? '', displayName ?? ''),
);
