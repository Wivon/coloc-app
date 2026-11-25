/**
 * Jeton secret aléatoire, en base64url : il doit pouvoir voyager dans un chemin
 * d'URL ou un en-tête HTTP sans échappement.
 *
 * `getRandomValues` est la source cryptographique de la plateforme ; `bytes`
 * fixe l'entropie (16 octets = 128 bits suffisent déjà à rendre la devinette
 * hors de portée).
 */
export function randomToken(prefix: string, bytes: number): string {
  return prefix + base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** base64url sans dépendance ni remplissage. */
export function base64url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
