import { startLogin } from '@/lib/auth/passkeys';
import { jsonRoute } from '@/lib/http';

export const POST = jsonRoute<{ email: string }>(({ email }) => startLogin(email ?? ''));
