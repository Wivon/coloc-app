import 'server-only';

import { ApiError } from './params';

/**
 * Réponses de l'API personnelle.
 *
 * CORS ouvert : l'authentification tient entièrement à l'en-tête
 * `Authorization`, qu'aucun site tiers ne peut forger à la place de l'utilisateur
 * — contrairement à un cookie. Un tableau de bord personnel servi depuis un autre
 * domaine peut donc appeler l'API directement.
 */
export const API_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
  'Access-Control-Max-Age': '86400',
  // Les soldes changent à chaque dépense : aucun intermédiaire ne doit en garder copie.
  'Cache-Control': 'no-store',
};

export function apiJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...API_HEADERS, ...extra } });
}

/** Format d'erreur unique : `{ "error": { "code", "message" } }`. */
export function apiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return apiJson(
      { error: { code: error.code, message: error.message } },
      error.status,
      error.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {},
    );
  }

  // Le détail (requête, message Postgres) reste dans les journaux : il ne sert à
  // rien à l'appelant et en dirait trop sur le schéma.
  console.error('[api/v1]', error);
  return apiJson({ error: { code: 'internal_error', message: 'Erreur interne.' } }, 500);
}

/** `Authorization: Bearer <jeton>` → jeton, sinon 401. */
export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) {
    throw new ApiError(
      401,
      'missing_token',
      'En-tête « Authorization: Bearer <jeton> » manquant. Le jeton se copie dans Réglages → API personnelle.',
    );
  }
  return match[1];
}
