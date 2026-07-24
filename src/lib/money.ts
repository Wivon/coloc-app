/**
 * Tout l'argent est manipulé en centimes (entiers) pour éviter les erreurs de
 * virgule flottante. Le formatage n'intervient qu'à l'affichage.
 */

/** Répartit `totalCents` entre `count` parts sans perdre le moindre centime. */
export function splitEvenly(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** "12,50" | "12.5" | "12" → 1250. Renvoie `null` si ce n'est pas un montant valide. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '' || normalized === '.') return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
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
