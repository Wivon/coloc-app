import 'server-only';

/**
 * Variables d'environnement serveur, validées une seule fois au premier accès.
 *
 * Les valeurs `NEXT_PUBLIC_*` sont lues directement (inlinées au build) et
 * exposées ici pour garder un seul endroit où chercher la config.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copiez .env.example vers .env.local et remplissez-la.`,
    );
  }
  return value;
}

function memo<T>(factory: () => T): () => T {
  let cached: { value: T } | null = null;
  return () => (cached ??= { value: factory() }).value;
}

export const serverEnv = memo(() => ({
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseServiceRoleKey: required(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  /** Clé de signature des cookies de session (32+ caractères aléatoires). */
  authSecret: required('AUTH_SECRET', process.env.AUTH_SECRET),
  appUrl: required('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, ''),
  vapid: {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:contact@example.com',
  },
  /** Secret partagé protégeant /api/cron/*. Optionnel en dev. */
  cronSecret: process.env.CRON_SECRET ?? '',
}));

/** Les notifications push ne sont activées que si les clés VAPID sont présentes. */
export function pushEnabled(): boolean {
  const { vapid } = serverEnv();
  return Boolean(vapid.publicKey && vapid.privateKey);
}
