import type { Metadata } from 'next';

import { PageHeader } from '@/components/PageHeader';
import { AddExpenseButton } from '@/components/expenses/AddExpenseButton';
import { ExpensesView } from '@/components/expenses/ExpensesView';
import { Card } from '@/components/ui/Card';
import { Amount } from '@/components/ui/Amount';
import { monthKey, today } from '@/lib/date';
import { listExpenses } from '@/lib/domain/expenses';
import { requireHouseholdContext } from '@/lib/domain/households';

export const metadata: Metadata = { title: 'Dépenses' };

export default async function ExpensesPage(props: PageProps<'/expenses'>) {
  const { household, user, members } = await requireHouseholdContext();
  const searchParams = await props.searchParams;
  const expenses = await listExpenses(household.id, { limit: 200 });

  const thisMonth = expenses.filter((expense) => monthKey(expense.spentOn) === monthKey(today()));
  const totalCents = thisMonth.reduce((total, expense) => total + expense.amountCents, 0);
  const myShareCents = thisMonth.reduce(
    (total, expense) =>
      total + (expense.shares.find((share) => share.userId === user.id)?.amountCents ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Dépenses"
        subtitle={household.name}
        user={user}
        action={
          <AddExpenseButton
            members={members}
            currentUserId={user.id}
            currency={household.currency}
            defaultOpen={searchParams.new === '1'}
          />
        }
      />

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
    </>
  );
}
