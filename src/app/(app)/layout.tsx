import { TabBar } from '@/components/TabBar';
import { requireHouseholdContext } from '@/lib/domain/households';

/**
 * Coquille des pages authentifiées. Le contexte est résolu ici : toute page de
 * ce groupe est garantie d'avoir un utilisateur connecté et une colocation.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireHouseholdContext();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4">
      <main className="flex-1 pb-28">{children}</main>
      <TabBar />
    </div>
  );
}
