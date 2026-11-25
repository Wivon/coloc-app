import { apiJson, API_HEADERS } from '@/lib/api/http';
import { RESOURCES } from '@/lib/api/resources';
import { apiBaseUrl } from '@/lib/domain/api-tokens';

/**
 * Racine de l'API : sans jeton, elle ne dit que ce qui existe. Un premier
 * `curl` sur l'URL copiée depuis les réglages répond donc quelque chose d'utile.
 */
export async function GET() {
  const base = apiBaseUrl();
  return apiJson({
    name: 'ColocApp API',
    version: 1,
    authentication: 'Authorization: Bearer <jeton>',
    documentation: `${base}/docs`,
    resources: Object.keys(RESOURCES).map((name) => `${base}/${name}`),
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: API_HEADERS });
}
