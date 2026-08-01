import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isClientToken, newClientToken } from '@/lib/client-token';

test('newClientToken produit un jeton valide et unique', () => {
  const tokens = new Set(Array.from({ length: 200 }, () => newClientToken()));

  assert.equal(tokens.size, 200);
  for (const token of tokens) assert.ok(isClientToken(token), token);
});

test('isClientToken refuse ce qui n’est pas un UUID', () => {
  for (const value of ['', 'nope', '123', '../../etc', `${newClientToken()}x`]) {
    assert.equal(isClientToken(value), false, value);
  }
});

test('isClientToken accepte ce que produit newClientToken, dans les deux cas', () => {
  // Le repli sans `crypto.randomUUID` (contexte non sécurisé) doit produire la
  // même forme : c'est cette valeur-là que le serveur revalide avant d'écrire.
  const { randomUUID } = crypto;
  try {
    Reflect.deleteProperty(crypto, 'randomUUID');
    const fallback = newClientToken();
    assert.ok(isClientToken(fallback), fallback);
    // Version 4 et variante RFC 4122, comme `crypto.randomUUID`.
    assert.equal(fallback[14], '4');
    assert.ok(['8', '9', 'a', 'b'].includes(fallback[19]));
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: randomUUID, configurable: true });
  }

  assert.ok(isClientToken(newClientToken()));
});
