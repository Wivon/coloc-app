import { TabBar } from '@/components/TabBar';

/**
 * Coquille des pages authentifiées.
 *
 * Volontairement synchrone : elle ne lit ni cookie ni base. Une mise en page qui
 * attend des données non cachées bloque la navigation côté client — le fallback
 * de `loading.tsx` ne peut pas s'afficher tant qu'elle n'a pas fini. En la
 * gardant statique, la structure et la barre d'onglets apparaissent
 * instantanément, et chaque page affiche son squelette pendant que ses données
 * arrivent.
 *
 * L'autorisation n'est pas perdue pour autant : chaque page du groupe appelle
 * `requireHouseholdContext()`, qui redirige vers `/login` ou `/onboarding`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4">
      <main className="flex-1 pb-28">{children}</main>
      <TabBar />
    </div>
  );
}
