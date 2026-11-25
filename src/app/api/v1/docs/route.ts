import { apiDocumentation } from '@/lib/api/docs';
import { API_HEADERS } from '@/lib/api/http';
import { apiBaseUrl } from '@/lib/domain/api-tokens';

/**
 * Documentation de l'API, en Markdown. Publique : elle ne contient aucun jeton,
 * seulement l'adresse de l'API — elle peut donc circuler sans risque.
 */
export async function GET() {
  return new Response(apiDocumentation(apiBaseUrl()), {
    headers: {
      ...API_HEADERS,
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'inline; filename="colocapp-api.md"',
    },
  });
}
