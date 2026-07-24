/** Catégories de dépense. Partagé serveur/client — pas d'import `server-only` ici. */
export const EXPENSE_CATEGORIES = [
  { id: 'courses', label: 'Courses', emoji: '🛒' },
  { id: 'maison', label: 'Maison', emoji: '🧻' },
  { id: 'factures', label: 'Factures', emoji: '💡' },
  { id: 'loyer', label: 'Loyer', emoji: '🏠' },
  { id: 'resto', label: 'Resto & sorties', emoji: '🍕' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'other', label: 'Autre', emoji: '📦' },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

const BY_ID = new Map(EXPENSE_CATEGORIES.map((category) => [category.id, category]));

export function category(id: string) {
  return BY_ID.get(id as ExpenseCategoryId) ?? BY_ID.get('other')!;
}

export function isExpenseCategory(value: string): value is ExpenseCategoryId {
  return BY_ID.has(value as ExpenseCategoryId);
}
