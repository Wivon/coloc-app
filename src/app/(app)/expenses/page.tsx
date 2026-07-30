import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { AddExpenseButton } from '@/components/expenses/AddExpenseButton';
import { ExpensesView } from '@/components/expenses/ExpensesView';
import { Amount } from '@/components/ui/Amount';
import { Card } from '@/components/ui/Card';
import { ExpensesContentSkeleton } from '@/components/PageSkeletons';
import { HeaderSkeleton } from '@/components/ui/Skeleton';
import { monthKey, today } from '@/lib/date';
import { listExpenses } from '@/lib/domain/expenses';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Dépenses' };

export default async function ExpensesPage(props: PageProps<'/expenses'>) {
  // `searchParams` alimente le raccourci « ?new=1 » de l'écran d'accueil. Il est
  // résolu ici, hors des frontières de données, car il n'exige aucune requête.
  const searchParams = await props.searchParams;
  const openSheet = searchParams.new === '1';

  return (
    <>
      <Suspense fallback={<HeaderSkeleton title="Dépenses" />}>
        <AppHeader title="Dépenses" action={<AddExpenseTrigger defaultOpen={openSheet} />} />
      </Suspense>

      <Suspense fallback={<ExpensesContentSkeleton />}>
        <ExpensesContent />
      </Suspense>
    </>
  );
}

/** Le bouton a besoin de la liste des colocs : il suspend avec l'en-tête. */
async function AddExpenseTrigger({ defaultOpen }: { defaultOpen: boolean }) {
  const { household, user, members } = await requireHouseholdContext();

  return (
    <AddExpenseButton
      members={members}
      currentUserId={user.id}
      currency={household.currency}
      defaultOpen={defaultOpen}
    />
  );
}

async function ExpensesContent() {
  const { household, user, members } = await requireHouseholdContext();
  const expenses = await listExpenses(household.id, { limit: 200 });

  const thisMonth = expenses.filter((expense) => monthKey(expense.spentOn) === monthKey(today()));
  const totalCents = thisMonth.reduce((total, expense) => total + expense.amountCents, 0);
  const myShareCents = thisMonth.reduce(
    (total, expense) =>
      total + (expense.shares.find((share) => share.userId === user.id)?.amountCents ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted">Ce mois-ci</p>
          <Amount
            cents={totalCents}
            currency={household.currency}
            className="text-[26px] font-semibold"
          />
        </div>
        <div className="text-right">
          <p className="text-[13px] text-muted">Ma part</p>
          <Amount
            cents={myShareCents}
            currency={household.currency}
            tone="muted"
            className="text-[17px] font-medium"
          />
        </div>
      </Card>

      <ExpensesView
        expenses={expenses}
        members={members}
        currentUserId={user.id}
        currency={household.currency}
      />
    </div>
  );
}

