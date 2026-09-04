/**
 * Protocole MCP — cadrage JSON-RPC 2.0, sans accès base ni dépendance serveur.
 *
 * L'app expose un serveur MCP « Streamable HTTP » : l'assistant poste un message
 * JSON-RPC, l'app répond en JSON. Pas de flux SSE, donc pas de session à tenir —
 * chaque appel est indépendant, ce qui va bien avec une route serverless.
 *
 * Écrit à la main plutôt qu'avec le SDK officiel : celui-ci suppose un serveur
 * Node de longue durée (`http.ServerResponse`, sessions en mémoire), là où il ne
 * s'agit ici que de quelques méthodes sur une route App Router. La logique tient
 * dans ce fichier, sans I/O — elle est donc testée.
 */

/** Versions comprises, la plus récente d'abord. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  /** Absent = notification : elle n'attend aucune réponse. */
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } };

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServer {
  name: string;
  version: string;
  /** Consignes remises à l'assistant après la poignée de main. */
  instructions?: string;
  tools: ToolDescriptor[];
  /** Renvoie le texte à remonter au modèle, ou lève pour signaler un échec. */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

/** Erreur de protocole — par opposition à un échec d'outil, qui est un résultat. */
export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/**
 * Traite un message, ou un lot (accepté par les versions ≤ 2025-03-26).
 *
 * Renvoie `null` quand il n'y a rien à répondre — le message n'était qu'une
 * notification, et le transport doit alors répondre 202 sans corps.
 */
export async function handleMessage(
  message: unknown,
  server: McpServer,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(message)) {
    if (message.length === 0) return failure(null, RPC_ERRORS.invalidRequest, 'Lot vide.');

    const responses = (await Promise.all(message.map((entry) => handleOne(entry, server)))).filter(
      (response): response is JsonRpcResponse => response !== null,
    );
    return responses.length > 0 ? responses : null;
  }

  return handleOne(message, server);
}

async function handleOne(message: unknown, server: McpServer): Promise<JsonRpcResponse | null> {
  if (!isRequest(message)) {
    return failure(null, RPC_ERRORS.invalidRequest, 'Message JSON-RPC invalide.');
  }

  const isNotification = message.id === undefined;

  try {
    const result = await route(message, server);
    // Une notification n'attend rien, même quand la méthode a produit un résultat.
    return isNotification ? null : { jsonrpc: '2.0', id: message.id ?? null, result };
  } catch (error) {
    if (isNotification) return null;
    if (error instanceof RpcError) {
      return failure(message.id ?? null, error.code, error.message);
    }

    console.error('[mcp]', error);
    return failure(
      message.id ?? null,
      RPC_ERRORS.internal,
      error instanceof Error ? error.message : 'Une erreur est survenue.',
    );
  }
}

async function route(request: JsonRpcRequest, server: McpServer): Promise<unknown> {
  const params = request.params ?? {};

  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: negotiateVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: server.name, version: server.version },
        ...(server.instructions ? { instructions: server.instructions } : {}),
      };

    case 'ping':
      return {};

    case 'tools/list':
      // Pas de pagination : la liste tient largement dans une réponse.
      return { tools: server.tools };

    case 'tools/call':
      return callTool(params, server);

    default:
      // `notifications/*` : rien à faire, et surtout rien à répondre.
      if (request.method.startsWith('notifications/')) return {};
      throw new RpcError(RPC_ERRORS.methodNotFound, `Méthode inconnue : ${request.method}`);
  }
}

/**
 * Un outil qui échoue renvoie un **résultat** marqué `isError`, pas une erreur de
 * protocole : le modèle voit le message, peut corriger ses arguments et
 * réessayer, là où une erreur JSON-RPC remonte à l'application hôte.
 */
async function callTool(params: Record<string, unknown>, server: McpServer): Promise<unknown> {
  const name = params.name;
  if (typeof name !== 'string') {
    throw new RpcError(RPC_ERRORS.invalidParams, 'Nom d’outil manquant.');
  }
  if (!server.tools.some((tool) => tool.name === name)) {
    throw new RpcError(RPC_ERRORS.invalidParams, `Outil inconnu : ${name}`);
  }

  const args = isRecord(params.arguments) ? params.arguments : {};

  try {
    return { content: [{ type: 'text', text: await server.callTool(name, args) }] };
  } catch (error) {
    console.error('[mcp:tool]', name, error);
    const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
    return { content: [{ type: 'text', text: `Erreur : ${message}` }], isError: true };
  }
}

/**
 * On répond dans la version demandée si on la connaît, sinon dans la nôtre —
 * c'est au client de décider s'il peut suivre.
 */
export function negotiateVersion(requested: unknown): string {
  const known = SUPPORTED_PROTOCOL_VERSIONS.find((version) => version === requested);
  return known ?? LATEST_PROTOCOL_VERSION;
}

function failure(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return (
    isRecord(value) &&
    value.jsonrpc === '2.0' &&
    typeof value.method === 'string' &&
    (value.params === undefined || isRecord(value.params)) &&
    (value.id === undefined ||
      value.id === null ||
      typeof value.id === 'string' ||
      typeof value.id === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
