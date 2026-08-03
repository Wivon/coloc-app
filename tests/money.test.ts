import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_AMOUNT_CENTS,
  formatMoney,
  formatMoneyCompact,
  isValidAmountCents,
  offsetFromId,
  parseAmountToCents,
  splitEvenly,
} from '@/lib/money';

test('splitEvenly ne perd aucun centime', () => {
  for (const [total, parts] of [
    [1000, 3],
    [1, 4],
    [4237, 7],
    [999999, 11],
  ] as const) {
    for (let offset = 0; offset < parts + 2; offset += 1) {
      const shares = splitEvenly(total, parts, offset);
      assert.equal(shares.length, parts);
      assert.equal(
        shares.reduce((sum, share) => sum + share, 0),
        total,
        `${total} / ${parts} (décalage ${offset})`,
      );
      // L'écart entre la plus grosse et la plus petite part ne dépasse jamais 1 centime.
      assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
    }
  }
});

test('splitEvenly gère les cas limites', () => {
  assert.deepEqual(splitEvenly(100, 0), []);
  assert.deepEqual(splitEvenly(0, 3), [0, 0, 0]);
  assert.deepEqual(splitEvenly(10, 3), [4, 3, 3]);
});

test('le décalage fait tourner le centime restant', () => {
  assert.deepEqual(splitEvenly(10, 3, 0), [4, 3, 3]);
  assert.deepEqual(splitEvenly(10, 3, 1), [3, 4, 3]);
  assert.deepEqual(splitEvenly(10, 3, 2), [3, 3, 4]);
  // Le décalage boucle, y compris hors bornes.
  assert.deepEqual(splitEvenly(10, 3, 3), [4, 3, 3]);
  assert.deepEqual(splitEvenly(10, 3, -1), [3, 3, 4]);
});

test('aucune position n’absorbe systématiquement l’arrondi', () => {
  // Régression : sans décalage, c’était toujours le premier participant qui
  // payait le centime en trop — un biais qui s’accumule dépense après dépense.
  const extra = [0, 0, 0];
  const runs = 600;

  for (let index = 0; index < runs; index += 1) {
    const id = `expense-${index}`;
    const shares = splitEvenly(1000 + (index % 7), 3, offsetFromId(id, 3));
    const min = Math.min(...shares);
    shares.forEach((share, position) => {
      if (share > min) extra[position] += 1;
    });
  }

  const total = extra.reduce((sum, count) => sum + count, 0);
  for (const [position, count] of extra.entries()) {
    assert.ok(count > 0, `la position ${position} ne reçoit jamais l’arrondi`);
    // Aucune position ne doit dépasser le double de sa part attendue.
    assert.ok(count < (total / 3) * 2, `la position ${position} est favorisée (${count}/${total})`);
  }
});

test('offsetFromId est déterministe et dans les bornes', () => {
  for (const count of [1, 2, 3, 7]) {
    for (const id of ['a', 'b0f8c2e1-1111-4222-8333-444455556666', '']) {
      const offset = offsetFromId(id, count);
      assert.equal(offset, offsetFromId(id, count), 'deux appels doivent coïncider');
      assert.ok(Number.isInteger(offset) && offset >= 0 && offset < count);
    }
  }
  assert.equal(offsetFromId('peu importe', 0), 0);
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

test('parseAmountToCents refuse les montants hors bornes', () => {
  // Régression : ces valeurs partaient en base et remontaient sous forme
  // d’erreur Postgres brute, faute de dépassement détecté ici.
  assert.equal(parseAmountToCents('99999999999999999999'), null);
  assert.equal(parseAmountToCents('1000000000'), null);
  assert.equal(parseAmountToCents(String(MAX_AMOUNT_CENTS / 100)), MAX_AMOUNT_CENTS);
});

test('isValidAmountCents filtre ce qui vient du client', () => {
  assert.ok(isValidAmountCents(1));
  assert.ok(isValidAmountCents(MAX_AMOUNT_CENTS));

  for (const value of [0, -1, 10.5, NaN, Infinity, MAX_AMOUNT_CENTS + 1, '100', null, undefined]) {
    assert.equal(isValidAmountCents(value), false, String(value));
  }
});

test('formatMoneyCompact tient dans une colonne de graphique', () => {
  // Sous 1 000 €, pas de décimale — c'est ce qui fait tenir « 407 € » là où
  // « 407,32 € » débordait sur la colonne voisine.
  assert.equal(strip(formatMoneyCompact(0)), '0 €');
  assert.equal(strip(formatMoneyCompact(6752)), '68 €');
  assert.equal(strip(formatMoneyCompact(40732)), '407 €');

  // Au-delà, l'abréviation reprend une décimale pour rester informative.
  assert.equal(strip(formatMoneyCompact(123456)), '1,2 k €');
  assert.equal(strip(formatMoneyCompact(1234567)), '12,3 k €');

  for (const cents of [0, 152, 6752, 40732, 123456, 9_999_999_99]) {
    assert.ok(formatMoneyCompact(cents).length <= 10, formatMoneyCompact(cents));
  }
});

/** `Intl` sépare avec des espaces insécables : on compare sur des espaces simples. */
const strip = (value: string) => value.replace(/ | /g, ' ');

test('formatMoney affiche le signe demandé', () => {
  assert.match(formatMoney(1250), /12,50/);
  assert.match(formatMoney(1250, 'EUR', { signed: true }), /^\+/);
  assert.match(formatMoney(-1250, 'EUR', { signed: true }), /^−/);
  // En mode compact, un montant rond perd ses décimales.
  assert.doesNotMatch(formatMoney(1200, 'EUR', { compact: true }), /,00/);
});
