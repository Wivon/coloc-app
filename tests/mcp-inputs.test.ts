import assert from 'node:assert/strict';
import { test } from 'node:test';

import { today } from '@/lib/date';
import {
  parseAmount,
  parseDate,
  parseMonth,
  resolveMemberId,
  resolveMemberIds,
  type NamedMember,
} from '@/lib/mcp/inputs';

const MEMBERS: NamedMember[] = [
  { id: 'u-lea', displayName: 'Léa', email: 'lea@example.com' },
  { id: 'u-marc', displayName: 'Marc Dupont', email: 'marc@example.com' },
  { id: 'u-marie', displayName: 'Marie', email: 'marie@example.com' },
];

const ME = 'u-lea';

test('un coloc se retrouve par identifiant, email, nom ou prénom', () => {
  for (const value of ['u-marc', 'marc@example.com', 'Marc Dupont', 'marc dupont', 'Marc']) {
    assert.equal(resolveMemberId(MEMBERS, value, ME), 'u-marc', value);
  }
  // Les accents ne doivent pas décider du résultat.
  assert.equal(resolveMemberId(MEMBERS, 'lea', ME), 'u-lea');
  assert.equal(resolveMemberId(MEMBERS, 'Léa', ME), 'u-lea');
});

test('sans valeur, ou avec « moi », c’est l’utilisateur courant', () => {
  for (const value of [undefined, '', '  ', 'moi', 'Moi', 'me']) {
    assert.equal(resolveMemberId(MEMBERS, value, ME), ME, String(value));
  }
});

test('un préfixe ambigu demande une précision au lieu de choisir', () => {
  // « Mar » désigne Marc comme Marie : deviner enregistrerait la dépense sur la
  // mauvaise personne, sans que personne ne s'en aperçoive.
  assert.throws(() => resolveMemberId(MEMBERS, 'Mar', ME), /plusieurs colocs/);
  assert.throws(() => resolveMemberId(MEMBERS, 'Bob', ME), /Coloc inconnu/);

  // Un nom complet reste exact même s'il est préfixe d'un autre.
  assert.equal(resolveMemberId(MEMBERS, 'Marie', ME), 'u-marie');
});

test('une liste de participants vide vaut toute la colocation', () => {
  assert.deepEqual(resolveMemberIds(MEMBERS, undefined, ME), ['u-lea', 'u-marc', 'u-marie']);
  assert.deepEqual(resolveMemberIds(MEMBERS, [], ME), ['u-lea', 'u-marc', 'u-marie']);

  // Deux façons de désigner la même personne ne la comptent qu'une fois : une
  // part en double fausserait la répartition.
  assert.deepEqual(resolveMemberIds(MEMBERS, ['moi', 'Léa', 'Marc'], ME), ['u-lea', 'u-marc']);
});

test('un montant est lu quelle que soit la forme produite par le modèle', () => {
  for (const [value, cents] of [
    [24.5, 2450],
    ['24.5', 2450],
    ['24,50', 2450],
    ['24,50 €', 2450],
    ['12', 1200],
    [' 8.07 ', 807],
  ] as const) {
    assert.equal(parseAmount(value), cents, String(value));
  }

  for (const value of ['', 'beaucoup', -3, 0, '1,2,3']) {
    assert.throws(() => parseAmount(value), /Montant invalide/, String(value));
  }
});

test('dates et mois sont validés avant d’atteindre Postgres', () => {
  assert.equal(parseDate('2026-03-14'), '2026-03-14');
  assert.equal(parseDate(undefined), today());
  assert.equal(parseDate(''), today());
  // Format valide mais date inexistante : refusée ici, pas par une erreur brute.
  assert.throws(() => parseDate('2026-02-31'), /Date invalide/);
  assert.throws(() => parseDate('14/03/2026'), /Date invalide/);

  assert.equal(parseMonth('2026-03'), '2026-03');
  assert.equal(parseMonth(undefined), today().slice(0, 7));
  assert.throws(() => parseMonth('2026-13'), /Mois invalide/);
  assert.throws(() => parseMonth('mars'), /Mois invalide/);
});
