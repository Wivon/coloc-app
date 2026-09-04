import { resolveMcpToken } from '@/lib/domain/mcp-tokens';
import { handleMessage, RPC_ERRORS } from '@/lib/mcp/protocol';
import { createMcpServer } from '@/lib/mcp/tools';

/**
 * Endpoint MCP personnel : `/api/mcp/<jeton>`.
 *
 * Transport « Streamable HTTP » réduit à sa forme la plus simple — un POST
 * JSON-RPC, une réponse JSON. Pas de flux SSE ni de session côté serveur : rien
 * à tenir entre deux appels, ce qui convient à une fonction serverless et évite
 * un état qui ne survivrait de toute façon pas au déploiement suivant.
 *
 * L'authentification tient entièrement au jeton du chemin : un connecteur MCP
 * distant appelle depuis l'infrastructure de l'assistant, sans cookie de session.
 * Chaque outil agit donc au nom du porteur, dans sa colocation — jamais dans une
 * autre, puisqu'aucun identifiant de coloc ne transite dans les arguments.
 */

/** Le connecteur peut appeler depuis un navigateur ; le jeton reste la seule clé. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

const HEADERS = { ...CORS, 'Cache-Control': 'no-store' };

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const identity = await resolveMcpToken(token);
  if (!identity) {
    return Response.json(
      { error: 'Lien MCP invalide ou révoqué. Copiez-le à nouveau depuis les réglages.' },
      { status: 401, headers: HEADERS },
    );
  }

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: RPC_ERRORS.parse, message: 'JSON invalide.' } },
      { status: 400, headers: HEADERS },
    );
  }

  const response = await handleMessage(message, createMcpServer(identity));

  // Rien à répondre : le message n'était qu'une notification (`initialized`…).
  if (response === null) return new Response(null, { status: 202, headers: HEADERS });

  return Response.json(response, { headers: HEADERS });
}

/**
 * Le transport autorise un GET pour ouvrir un flux SSE ; on n'en propose pas, et
 * la spécification demande alors un 405 explicite plutôt qu'un silence.
 */
export async function GET() {
  return Response.json(
    { error: 'Cet endpoint MCP ne répond qu’en POST (Streamable HTTP sans flux SSE).' },
    { status: 405, headers: { ...HEADERS, Allow: 'POST, OPTIONS' } },
  );
}

/** Fin de session : il n'y en a pas à fermer, mais le client doit avoir sa réponse. */
export async function DELETE() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}
