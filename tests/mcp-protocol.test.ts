import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  handleMessage,
  LATEST_PROTOCOL_VERSION,
  negotiateVersion,
  RPC_ERRORS,
  type JsonRpcResponse,
  type McpServer,
} from '@/lib/mcp/protocol';

function server(overrides: Partial<McpServer> = {}): McpServer {
  return {
    name: 'colocapp',
    version: '1.0.0',
    tools: [{ name: 'add_expense', description: '', inputSchema: { type: 'object' } }],
    async callTool(name, args) {
      if (name === 'add_expense' && args.fail) throw new Error('Montant invalide.');
      return `appelé ${name}`;
    },
    ...overrides,
  };
}

const single = async (message: unknown, mcp = server()) =>
  (await handleMessage(message, mcp)) as JsonRpcResponse;

const result = (response: JsonRpcResponse) => {
  assert.ok('result' in response, `réponse en erreur : ${JSON.stringify(response)}`);
  return response.result as Record<string, unknown>;
};

const error = (response: JsonRpcResponse) => {
  assert.ok('error' in response, `réponse en succès : ${JSON.stringify(response)}`);
  return response.error;
};

test('initialize répond dans la version demandée quand elle est connue', async () => {
  const known = await single({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05' },
  });
  assert.equal(result(known).protocolVersion, '2024-11-05');

  // Version inconnue : on annonce la nôtre, au client de décider s'il suit.
  const unknown = await single({
    jsonrpc: '2.0',
    id: 2,
    method: 'initialize',
    params: { protocolVersion: '1999-01-01' },
  });
  assert.equal(result(unknown).protocolVersion, LATEST_PROTOCOL_VERSION);
  assert.equal(negotiateVersion(undefined), LATEST_PROTOCOL_VERSION);
});

test('une notification ne produit aucune réponse', async () => {
  assert.equal(
    await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, server()),
    null,
  );
});

test('tools/list expose les outils déclarés', async () => {
  const response = await single({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.deepEqual((result(response).tools as { name: string }[]).map((t) => t.name), [
    'add_expense',
  ]);
});

test("l'échec d'un outil est un résultat, pas une erreur de protocole", async () => {
  // C'est ce qui permet au modèle de lire le message et de corriger ses
  // arguments : une erreur JSON-RPC, elle, remonterait à l'application hôte.
  const response = await single({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'add_expense', arguments: { fail: true } },
  });

  const payload = result(response);
  assert.equal(payload.isError, true);
  assert.match((payload.content as { text: string }[])[0].text, /Montant invalide/);
});

test('un outil inconnu est une erreur de protocole', async () => {
  const response = await single({
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/call',
    params: { name: 'drop_database' },
  });
  assert.equal(error(response).code, RPC_ERRORS.invalidParams);
});

test('méthode inconnue et message malformé sont rejetés proprement', async () => {
  const unknownMethod = await single({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
  assert.equal(error(unknownMethod).code, RPC_ERRORS.methodNotFound);

  const malformed = await single({ hello: 'world' });
  assert.equal(error(malformed).code, RPC_ERRORS.invalidRequest);
  assert.equal(malformed.id, null);
});

test('un lot ne renvoie que les réponses attendues', async () => {
  const responses = (await handleMessage(
    [
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ],
    server(),
  )) as JsonRpcResponse[];

  assert.equal(responses.length, 2);
  assert.deepEqual(
    responses.map((response) => response.id),
    [1, 2],
  );

  // Un lot de notifications seules n'attend rien du tout.
  assert.equal(
    await handleMessage([{ jsonrpc: '2.0', method: 'notifications/cancelled' }], server()),
    null,
  );
});
