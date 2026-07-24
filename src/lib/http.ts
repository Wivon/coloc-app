import 'server-only';
import { NextResponse } from 'next/server';

import { AuthError } from '@/lib/auth/passkeys';

/** Enveloppe un handler d'API : parse le corps JSON et normalise les erreurs. */
export function jsonRoute<TBody>(
  handler: (body: TBody, request: Request) => Promise<unknown>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    let body: TBody;
    try {
      body = (await request.json()) as TBody;
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    try {
      return NextResponse.json((await handler(body, request)) ?? { ok: true });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error('[api]', error);
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
