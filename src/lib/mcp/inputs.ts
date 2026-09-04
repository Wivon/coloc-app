/**
 * Lecture des arguments produits par un modèle — logique pure, donc testée.
 *
 * Un assistant ne connaît pas les UUID de la colocation : il écrit « Alice »,
 * « moi », « 24,50 € ». Tout ce fichier sert à ramener ces valeurs approximatives
 * à quelque chose que la couche domaine accepte, ou à lever un message assez
 * explicite pour que le modèle corrige de lui-même et réessaie.
 */

import { parseAmountToCents } from '@/lib/money';
import { isIsoDate, monthKey, today } from '@/lib/date';
import type { IsoDate, Uuid } from '@/lib/db/types';

export interface NamedMember {
  id: Uuid;
  displayName: string;
  email: string;
}

/** Désignations de l'utilisateur courant acceptées en plus de son nom. */
const SELF_ALIASES = ['moi', 'me', 'myself', 'self', 'moi-même', 'moi meme'];

/**
 * Retrouve un coloc à partir de ce qu'a écrit le modèle : identifiant, email,
 * nom complet, ou simple prénom.
 *
 * Une correspondance partielle n'est retenue que si elle est **unique** : deux
 * « Marie » dans la coloc doivent produire une question, pas un tirage au sort
 * qui enregistrerait la dépense sur la mauvaise personne.
 */
export function resolveMemberId(
  members: NamedMember[],
  value: string | undefined | null,
  currentUserId: Uuid,
): Uuid {
  const raw = (value ?? '').trim();
  if (!raw) return currentUserId;

  const needle = fold(raw);
  if (SELF_ALIASES.includes(needle)) return currentUserId;

  const exact = members.find(
    (member) =>
      member.id === raw || fold(member.email) === needle || fold(member.displayName) === needle,
  );
  if (exact) return exact.id;

  const partial = members.filter(
    (member) =>
      fold(member.displayName).startsWith(needle) || fold(member.email).startsWith(needle),
  );
  if (partial.length === 1) return partial[0].id;

  if (partial.length > 1) {
    throw new Error(
      `« ${raw} » désigne plusieurs colocs (${partial.map((m) => m.displayName).join(', ')}). Précisez lequel.`,
    );
  }

  throw new Error(`Coloc inconnu : « ${raw} ». Colocs : ${members.map((m) => m.displayName).join(', ')}.`);
}

/** Liste de colocs ; vide ou absente, elle vaut « toute la colocation ». */
export function resolveMemberIds(
  members: NamedMember[],
  values: string[] | undefined,
  currentUserId: Uuid,
): Uuid[] {
  if (!values || values.length === 0) return members.map((member) => member.id);
  return [...new Set(values.map((value) => resolveMemberId(members, value, currentUserId)))];
}

/**
 * Montant en euros → centimes. Accepte un nombre (`24.5`) comme une chaîne
 * (`« 24,50 € »`) : les deux sortent d'un modèle selon la façon dont la question
 * a été posée.
 */
export function parseAmount(value: unknown): number {
  const text =
    typeof value === 'number'
      ? String(value)
      : String(value ?? '')
          .replace(/[€\s]/g, '')
          .replace(/eur(os?)?$/i, '');

  const cents = parseAmountToCents(text);
  if (!cents) throw new Error(`Montant invalide : « ${String(value)} ». Attendu : un nombre en euros, ex. 24.50`);
  return cents;
}

/** Date de dépense/remboursement. Absente, c'est aujourd'hui. */
export function parseDate(value: string | undefined | null): IsoDate {
  const raw = (value ?? '').trim();
  if (!raw) return today();
  if (!isIsoDate(raw)) throw new Error(`Date invalide : « ${raw} ». Format attendu : AAAA-MM-JJ.`);
  return raw;
}

/** Mois 'AAAA-MM'. Absent, c'est le mois en cours. */
export function parseMonth(value: string | undefined | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return monthKey(today());
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new Error(`Mois invalide : « ${raw} ». Format attendu : AAAA-MM.`);
  }
  return raw;
}

/** Minuscules sans accents ni ponctuation : « Léa » et « lea » se rejoignent. */
function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
