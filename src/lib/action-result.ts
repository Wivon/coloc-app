/**
 * Résultat uniforme des Server Actions : elles ne lèvent jamais d'erreur vers le
 * client, elles renvoient un message affichable. Les formulaires peuvent ainsi
 * utiliser `useActionState` sans try/catch.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    console.error('[action]', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Une erreur est survenue.',
    };
  }
}
