/** Palette des pastilles de coloc. Partagée serveur (attribution) et client (rendu). */
export const AVATAR_COLORS = [
  'moss',
  'clay',
  'sky',
  'plum',
  'amber',
  'teal',
  'rose',
  'slate',
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export function isAvatarColor(value: string): value is AvatarColor {
  return (AVATAR_COLORS as readonly string[]).includes(value);
}

/** Couleur stable dérivée d'un identifiant, utilisée comme valeur par défaut. */
export function colorForId(id: string): AvatarColor {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
