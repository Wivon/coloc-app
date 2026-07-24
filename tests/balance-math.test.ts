import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeBalances, simplifyDebts } from '@/lib/domain/balance-math';
import { splitEvenly } from '@/lib/money';

const [ana, bob, cleo] = ['ana', 'bob', 'cleo'];
const members = [ana, bob, cleo];

/** Dépense partagée équitablement, comme le fait `createExpense`. */
function shared(payerId: string, amountCents: number, participants: string[] = members) {
  const amounts = splitEvenly(amountCents, participants.length);
  return {
    payerId,
    amountCents,
    shares: participants.map((userId, index) => ({ userId, amountCents: amounts[index] })),
  };
}

test('la somme des soldes est toujours nulle', () => {
  const balances = computeBalances(
    members,
    [shared(ana, 6000), shared(bob, 3000), shared(cleo, 1501, [ana, cleo])],
    [{ fromUserId: bob, toUserId: ana, amountCents: 500 }],
  );

  assert.equal(
    balances.reduce((sum, balance) => sum + balance.netCents, 0),
    0,
  );
});

test('celui qui avance est créancier de la part des autres', () => {
  const balances = computeBalances(members, [shared(ana, 3000)], []);
  const byUser = Object.fromEntries(balances.map((balance) => [balance.userId, balance.netCents]));

  assert.equal(byUser[ana], 2000);
  assert.equal(byUser[bob], -1000);
  assert.equal(byUser[cleo], -1000);
});

test('un remboursement ramène le solde à zéro', () => {
  const expenses = [shared(ana, 3000)];
  const settlements = [
    { fromUserId: bob, toUserId: ana, amountCents: 1000 },
    { fromUserId: cleo, toUserId: ana, amountCents: 1000 },
  ];

  for (const balance of computeBalances(members, expenses, settlements)) {
    assert.equal(balance.netCents, 0, balance.userId);
  }
});

test('simplifyDebts solde tout le monde en n−1 virements au plus', () => {
  const balances = computeBalances(
    members,
    [shared(ana, 9000), shared(bob, 1500, [bob, cleo])],
    [],
  );
  const transfers = simplifyDebts(balances);

  assert.ok(transfers.length <= members.length - 1);

  // Les virements appliqués remettent chaque solde à zéro.
  const after = new Map(balances.map((balance) => [balance.userId, balance.netCents]));
  for (const transfer of transfers) {
    after.set(transfer.fromUserId, (after.get(transfer.fromUserId) ?? 0) + transfer.amountCents);
    after.set(transfer.toUserId, (after.get(transfer.toUserId) ?? 0) - transfer.amountCents);
  }
  for (const [userId, net] of after) assert.equal(net, 0, userId);
});

test('aucun virement quand tout est déjà équilibré', () => {
  const balances = computeBalances(members, [shared(ana, 3000)], [
    { fromUserId: bob, toUserId: ana, amountCents: 1000 },
    { fromUserId: cleo, toUserId: ana, amountCents: 1000 },
  ]);

  assert.deepEqual(simplifyDebts(balances), []);
});

test('un ancien coloc absent de la liste des membres est pris en compte', () => {
  const balances = computeBalances([ana, bob], [shared('parti', 2000, [ana, bob, 'parti'])], []);
  const parti = balances.find((balance) => balance.userId === 'parti');

  assert.ok(parti, 'le payeur doit apparaître dans les soldes');
  assert.equal(
    balances.reduce((sum, balance) => sum + balance.netCents, 0),
    0,
  );
});
