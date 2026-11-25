import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiError, readDate, readFlag, readLimit, readMonth, readRange } from '@/lib/api/params';

const q = (query: string) => new URLSearchParams(query);

function assertBadRequest(fn: () => unknown) {
  assert.throws(fn, (error: unknown) => error instanceof ApiError && error.status === 400);
}

test('readLimit retombe sur la valeur par défaut et refuse le reste', () => {
  assert.equal(readLimit(q(''), 'limit', 50, 500), 50);
  assert.equal(readLimit(q('limit='), 'limit', 50, 500), 50);
  assert.equal(readLimit(q('limit=12'), 'limit', 50, 500), 12);
  assert.equal(readLimit(q('limit=500'), 'limit', 50, 500), 500);
  assertBadRequest(() => readLimit(q('limit=0'), 'limit', 50, 500));
  assertBadRequest(() => readLimit(q('limit=501'), 'limit', 50, 500));
  assertBadRequest(() => readLimit(q('limit=-3'), 'limit', 50, 500));
  assertBadRequest(() => readLimit(q('limit=2.5'), 'limit', 50, 500));
  assertBadRequest(() => readLimit(q('limit=abc'), 'limit', 50, 500));
});

test('readDate n’accepte que des dates qui existent', () => {
  assert.equal(readDate(q(''), 'from'), undefined);
  assert.equal(readDate(q('from=2026-02-28'), 'from'), '2026-02-28');
  assertBadRequest(() => readDate(q('from=2026-02-30'), 'from'));
  assertBadRequest(() => readDate(q('from=2026-13-01'), 'from'));
  assertBadRequest(() => readDate(q('from=01/02/2026'), 'from'));
});

test('readMonth attend AAAA-MM', () => {
  assert.equal(readMonth(q(''), 'month'), undefined);
  assert.equal(readMonth(q('month=2026-09'), 'month'), '2026-09');
  assertBadRequest(() => readMonth(q('month=2026-9'), 'month'));
  assertBadRequest(() => readMonth(q('month=2026-13'), 'month'));
});

test('readFlag ne devine pas', () => {
  assert.equal(readFlag(q(''), 'mine'), false);
  assert.equal(readFlag(q('mine=true'), 'mine'), true);
  assert.equal(readFlag(q('mine=1'), 'mine'), true);
  assert.equal(readFlag(q('mine=false'), 'mine'), false);
  assertBadRequest(() => readFlag(q('mine=yes'), 'mine'));
});

test('readRange applique les défauts et borne la période', () => {
  const defaults = { from: '2026-09-01', to: '2026-09-21' };

  assert.deepEqual(readRange(q(''), defaults, 120), defaults);
  assert.deepEqual(readRange(q('to=2026-10-01'), defaults, 120), { from: '2026-09-01', to: '2026-10-01' });
  // Avec seulement `from`, la fin suit le début au lieu de rester sur le défaut,
  // qui pourrait tomber avant lui.
  assert.deepEqual(readRange(q('from=2026-12-01'), defaults, 30), { from: '2026-12-01', to: '2026-12-31' });

  assertBadRequest(() => readRange(q('from=2026-09-10&to=2026-09-01'), defaults, 120));
  assertBadRequest(() => readRange(q('from=2026-01-01&to=2026-12-31'), defaults, 120));
});
