/**
 * Jeton d'intention, partagé client/serveur.
 *
 * L'interface en tire un par bouton affiché ; le serveur le transmet à
 * `record_settlements`, dont l'index unique
 * `(household_id, client_token, from_user_id, to_user_id)` transforme un rejeu —
 * double tap, retry réseau, soumission renvoyée — en mise à jour de la ligne déjà
 * écrite plutôt qu'en second remboursement.
 *
 * Le destinataire fait partie de la clé : rejouer une intention vers un **autre**
 * coloc doit écrire une nouvelle ligne, pas réécrire la précédente — sans quoi un
 * remboursement réellement versé serait effacé.
 *
 * Réservé aux enregistrements dont le montant vient de l'utilisateur. Quand le
 * serveur recalcule le montant, il n'y a plus rien à solder après un premier
 * succès : le rejeu est inoffensif sans jeton, et en réutiliser un serait même
 * dangereux sur un ensemble de virements qui a changé entre-temps.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newClientToken(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  // Repli pour les contextes non sécurisés, où `randomUUID` n'est pas exposé
  // alors que `getRandomValues` l'est (http://<ip> sur un téléphone du réseau).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isClientToken(value: string): boolean {
  return UUID_PATTERN.test(value);
}
