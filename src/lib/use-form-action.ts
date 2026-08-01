'use client';

import { useState } from 'react';

import type { ActionResult } from '@/lib/action-result';

/**
 * Soumet une Server Action depuis un `<form action={...}>` et traite le succès
 * une seule fois.
 *
 * Remplace le couple `useActionState` + `useEffect` : le résultat de
 * `useActionState` est « collant », il survit à tous les rendus suivants. Un
 * effet du type « si le résultat est ok, ferme la feuille » se redéclenche donc
 * au rendu d'après — et comme les callbacks inline (`onClose={() =>
 * setOpen(false)}`) changent d'identité à chaque rendu du parent, l'effet se
 * relançait et refermait la feuille aussitôt rouverte.
 *
 * Ici `onSuccess` est appelé dans le flux de soumission, jamais depuis un effet :
 * il ne peut pas se rejouer. `useFormStatus` continue de fonctionner dans le
 * formulaire, React suivant l'état d'attente de l'action.
 */
export function useFormAction<T>(
  action: (formData: FormData) => Promise<ActionResult<T>>,
  onSuccess?: (data: T) => void,
) {
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData): Promise<void> {
    // `attempt` ne convertit que ce qui est levé *dans* l'action. Une réponse
    // perdue ou une erreur de transport rejette ici : sans ce `catch`, la
    // soumission échouait sans rien afficher, et l'utilisateur renvoyait le
    // formulaire en croyant que rien n'avait été enregistré.
    let result: ActionResult<T>;
    try {
      result = await action(formData);
    } catch {
      setError('Envoi impossible. Vérifie ta connexion et réessaie.');
      return;
    }

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onSuccess?.(result.data);
  }

  return { submit, error };
}
