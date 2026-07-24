import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMoney, parseAmountToCents, splitEvenly } from '@/lib/money';

test('splitEvenly ne perd aucun centime', () => {
  for (const [total, parts] of [
    [1000, 3],
    [1, 4],
    [4237, 7],
    [999999, 11],
  ] as const) {
    const shares = splitEvenly(total, parts);
    assert.equal(shares.length, parts);
    assert.equal(
      shares.reduce((sum, share) => sum + share, 0),
      total,
      `${total} / ${parts}`,
    );
    // L'écart entre la plus grosse et la plus petite part ne dépasse jamais 1 centime.
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  }
});

test('splitEvenly gère les cas limites', () => {
  assert.deepEqual(splitEvenly(100, 0), []);
  assert.deepEqual(splitEvenly(0, 3), [0, 0, 0]);
  assert.deepEqual(splitEvenly(10, 3), [4, 3, 3]);
});

test('parseAmountToCents accepte les formats français', () => {
  assert.equal(parseAmountToCents('12,50'), 1250);
  assert.equal(parseAmountToCents('12.5'), 1250);
  assert.equal(parseAmountToCents(' 42 '), 4200);
  assert.equal(parseAmountToCents('0,01'), 1);
  assert.equal(parseAmountToCents(''), null);
  assert.equal(parseAmountToCents('abc'), null);
  assert.equal(parseAmountToCents('-5'), null);
});

test('formatMoney affiche le signe demandé', () => {
  assert.match(formatMoney(1250), /12,50/);
  assert.match(formatMoney(1250, 'EUR', { signed: true }), /^\+/);
  assert.match(formatMoney(-1250, 'EUR', { signed: true }), /^−/);
  // En mode compact, un montant rond perd ses décimales.
  assert.doesNotMatch(formatMoney(1200, 'EUR', { compact: true }), /,00/);
});
