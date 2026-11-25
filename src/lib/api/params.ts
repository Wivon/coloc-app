/**
 * Lecture des paramètres de requête de l'API personnelle — logique pure, donc
 * testée.
 *
 * Un paramètre mal formé est refusé avec un 400 explicite plutôt qu'ignoré : un
 * `from=2026-13-01` silencieusement remplacé par la valeur par défaut rendrait
 * une période que l'appelant n'a pas demandée, et il bâtirait ses totaux dessus.
 */

import { addDays, daysBetween, isIsoDate } from '@/lib/date';
import type { IsoDate } from '@/lib/db/types';

/** Erreur destinée à l'appelant : elle porte son statut HTTP et un code stable. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const badRequest = (message: string) => new ApiError(400, 'invalid_parameter', message);

/** Entier borné. Absent : `fallback`. */
export function readLimit(
  params: URLSearchParams,
  name: string,
  fallback: number,
  max: number,
): number {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw badRequest(`« ${name} » doit être un entier positif.`);

  const value = Number(raw);
  if (value < 1 || value > max) throw badRequest(`« ${name} » doit être compris entre 1 et ${max}.`);
  return value;
}

/** Date AAAA-MM-JJ facultative. */
export function readDate(params: URLSearchParams, name: string): IsoDate | undefined {
  const raw = params.get(name);
  if (raw === null || raw === '') return undefined;
  if (!isIsoDate(raw)) throw badRequest(`« ${name} » doit être une date AAAA-MM-JJ valide.`);
  return raw;
}

/** Mois AAAA-MM facultatif. */
export function readMonth(params: URLSearchParams, name: string): string | undefined {
  const raw = params.get(name);
  if (raw === null || raw === '') return undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) throw badRequest(`« ${name} » doit être un mois AAAA-MM.`);
  return raw;
}

/** Booléen : `true`/`1` ou `false`/`0`. Absent : `false`. */
export function readFlag(params: URLSearchParams, name: string): boolean {
  const raw = params.get(name);
  if (raw === null || raw === '') return false;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw badRequest(`« ${name} » doit valoir true ou false.`);
}

/**
 * Période `from`/`to` bornée à `maxDays`, chaque borne retombant sur sa valeur
 * par défaut. Une période à l'envers ou démesurée est refusée : sur l'agenda des
 * tâches, elle déclencherait la lecture de mois de planning pour rien.
 */
export function readRange(
  params: URLSearchParams,
  defaults: { from: IsoDate; to: IsoDate },
  maxDays: number,
): { from: IsoDate; to: IsoDate } {
  const from = readDate(params, 'from') ?? defaults.from;
  const to = readDate(params, 'to') ?? (params.has('from') ? addDays(from, maxDays) : defaults.to);

  if (to < from) throw badRequest('« to » doit être postérieure ou égale à « from ».');
  if (daysBetween(from, to) > maxDays) {
    throw badRequest(`La période ne peut pas dépasser ${maxDays} jours.`);
  }
  return { from, to };
}
