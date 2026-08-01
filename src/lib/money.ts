/**
 * Tout l'argent est manipulé en centimes (entiers) pour éviter les erreurs de
 * virgule flottante. Le formatage n'intervient qu'à l'affichage.
 */

/**
 * Plafond de saisie : ~100 M€. Très au-delà de tout usage réel, mais assez bas
 * pour rester un entier sûr en JS et tenir dans un `bigint` côté base — un
 * montant absurde est refusé ici plutôt que par une erreur Postgres brute.
 */
export const MAX_AMOUNT_CENTS = 9_999_999_999;

/**
 * Répartit `totalCents` entre `count` parts sans perdre le moindre centime.
 *
 * Le reste (au plus `count − 1` centimes) est attribué à partir de `offset`, en
 * tournant. Sans ce décalage, c'est toujours la même position — donc toujours le
 * même coloc — qui absorbe le centime en trop : sur des centaines de dépenses le
 * biais devient visible.
 */
export function splitEvenly(totalCents: number, count: number, offset = 0): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const start = ((offset % count) + count) % count;

  return Array.from({ length: count }, (_, index) => {
    const rank = (index - start + count) % count;
    return base + (rank < remainder ? 1 : 0);
  });
}

/**
 * Décalage stable dérivé d'un identifiant, pour `splitEvenly`. Deux dépenses
 * différentes ne favorisent pas le même coloc, et rejouer la même dépense donne
 * toujours la même répartition.
 */
export function offsetFromId(id: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 2_147_483_647;
  }
  return hash % count;
}

/** "12,50" | "12.5" | "12" → 1250. Renvoie `null` si ce n'est pas un montant valide. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '' || normalized === '.') return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

/**
 * Un montant en centimes reçu d'un client est-il exploitable ? Les Server Actions
 * peuvent être appelées avec n'importe quelle valeur, pas seulement celle qu'a
 * rendue l'interface.
 */
export function isValidAmountCents(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_AMOUNT_CENTS
  );
}

export function formatMoney(
  cents: number,
  currency = 'EUR',
  options: { signed?: boolean; compact?: boolean } = {},
): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: options.compact && cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);

  if (!options.signed || cents === 0) return cents < 0 ? `−${formatted}` : formatted;
  return `${cents > 0 ? '+' : '−'}${formatted}`;
}

/** Montant sans symbole, pour les champs de saisie. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
