import type { IsoDate } from '@/lib/db/types';

/**
 * Dates « calendaires » (sans fuseau) manipulées comme des chaînes 'YYYY-MM-DD'.
 * Suffisant pour des échéances de tâches et des dates de dépense, et évite les
 * décalages de timezone entre le serveur et le téléphone.
 */

export function today(): IsoDate {
  return toIsoDate(new Date());
}

/**
 * `value` est-il bien une date calendaire 'YYYY-MM-DD' existante ?
 *
 * Le format seul ne suffit pas : '2026-02-31' passe la regex mais Postgres la
 * rejette avec une erreur brute, affichée telle quelle à l'utilisateur.
 */
export function isIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(value: IsoDate): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = fromIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = fromIsoDate(to).getTime() - fromIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Premier jour du mois, décalé de `offset` mois. */
export function startOfMonth(value: IsoDate, offset = 0): IsoDate {
  const date = fromIsoDate(value);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

export function monthKey(value: IsoDate): string {
  return value.slice(0, 7);
}

const relativeFormatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

/** « aujourd'hui », « demain », « il y a 3 jours »… */
export function formatDueDate(due: IsoDate, reference: IsoDate = today()): string {
  const diff = daysBetween(reference, due);
  if (Math.abs(diff) <= 1) return relativeFormatter.format(diff, 'day');
  if (diff > 1 && diff < 7) return capitalize(formatWeekday(due));
  return formatShortDate(due);
}

export function formatShortDate(value: IsoDate): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    fromIsoDate(value),
  );
}

export function formatLongDate(value: IsoDate): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromIsoDate(value));
}

export function formatWeekday(value: IsoDate): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(fromIsoDate(value));
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  );
}

export function formatMonthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(y, m - 1, 1));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
