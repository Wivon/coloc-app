import 'server-only';
import {
  createClient,
  type PostgrestSingleResponse,
  type SupabaseClient,
} from '@supabase/supabase-js';

import { serverEnv } from '@/lib/env';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;

/**
 * Client Supabase `service_role` — contourne RLS, donc **uniquement côté serveur**.
 *
 * Toutes les tables ont RLS actif sans policy : c'est la seule façon d'accéder aux
 * données, et l'autorisation est faite explicitement dans la couche domaine
 * (`requireMembership`, `requireUser`). Ne jamais importer ce module depuis un
 * composant client.
 */
export function db(): SupabaseClient<Database> {
  if (client) return client;
  const env = serverEnv();
  client = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'colocapp' } },
  });
  return client;
}

/**
 * Déballe une réponse Supabase en levant une erreur explicite si besoin.
 *
 * Le paramètre est typé avec `PostgrestSingleResponse` plutôt qu'une forme
 * approchée : la réponse est une union `succès | échec`, et une signature
 * approximative ferait silencieusement inférer `never` pour `T`.
 * Une requête de liste renvoie `PostgrestResponse<Row>`, alias de
 * `PostgrestSingleResponse<Row[]>` — la même signature couvre les deux cas.
 */
export function unwrap<T>(result: PostgrestSingleResponse<T>): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) {
    throw new Error('Résultat vide inattendu.');
  }
  return result.data;
}
