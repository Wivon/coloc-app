import { ExpensesContentSkeleton } from '@/components/PageSkeletons';
import { HeaderSkeleton } from '@/components/ui/Skeleton';

/**
 * Affiché dès le clic sur l'onglet, sans aller-retour réseau : cette UI fait
 * partie du prefetch du lien. Identique au fallback interne de la page.
 */
export default function Loading() {
  return (
    <>
      <HeaderSkeleton title="Dépenses" />
      <ExpensesContentSkeleton />
    </>
  );
}
