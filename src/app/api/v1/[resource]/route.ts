import { apiError, apiJson, API_HEADERS, bearerToken } from '@/lib/api/http';
import { ApiError } from '@/lib/api/params';
import { RESOURCES } from '@/lib/api/resources';
import { resolveApiToken } from '@/lib/domain/api-tokens';

/**
 * API personnelle, en lecture seule : `GET /api/v1/<ressource>`.
 *
 * L'authentification tient au jeton de l'en-tête `Authorization` ; chaque
 * ressource lit la colocation de son porteur, jamais une autre. La liste des
 * ressources et leur format sont décrits dans `GET /api/v1/docs`.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/v1/[resource]'>) {
  try {
    const { resource } = await ctx.params;

    // La ressource est vérifiée avant le jeton : une faute de frappe dans l'URL
    // mérite un 404 qui le dit, pas un 401 qui ferait chercher du côté du jeton.
    const handler = Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : undefined;
    if (!handler) {
      throw new ApiError(
        404,
        'unknown_resource',
        `Ressource inconnue : « ${resource} ». Disponibles : ${Object.keys(RESOURCES).join(', ')}.`,
      );
    }

    const identity = await resolveApiToken(bearerToken(request));
    if (!identity) {
      throw new ApiError(
        401,
        'invalid_token',
        'Jeton invalide ou révoqué. Copiez-le à nouveau depuis Réglages → API personnelle.',
      );
    }

    return apiJson(await handler(identity, new URL(request.url).searchParams));
  } catch (error) {
    return apiError(error);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: API_HEADERS });
}
