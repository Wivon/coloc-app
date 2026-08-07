import 'server-only';

import { addDays, monthKey, startOfMonth, today } from '@/lib/date';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import type { Uuid } from '@/lib/db/types';
import { listExpenses, type Expense } from './expenses';

const TREND_MONTHS = 6;

export interface CategorySlice {
  id: string;
  amountCents: number;
  /** Part du total du mois, entre 0 et 1. */
  ratio: number;
}

export interface MemberSpending {
  userId: Uuid;
  /** Ce que la personne a avancé. */
  paidCents: number;
  /** Ce qu'elle a réellement consommé (somme de ses parts). */
  shareCents: number;
}

export interface Insights {
  month: string;
  totalCents: number;
  previousTotalCents: number;
  /** Variation vs mois précédent, `null` si le mois précédent est vide. */
  changeRatio: number | null;
  expenseCount: number;
  dailyAverageCents: number;
  byCategory: CategorySlice[];
  byMember: MemberSpending[];
  trend: { month: string; amountCents: number }[];
  topExpenses: Expense[];
}

/** `month` au format 'YYYY-MM'. Par défaut le mois en cours. */
export async function getInsights(
  householdId: Uuid,
  memberIds: Uuid[],
  month: string = monthKey(today()),
): Promise<Insights> {
  const monthStart = `${month}-01`;
  const trendStart = startOfMonth(monthStart, -(TREND_MONTHS - 1));
  const monthEnd = addDays(startOfMonth(monthStart, 1), -1);

  // Une seule requête couvre le mois affiché, le mois précédent et la tendance.
  const expenses = await listExpenses(householdId, { from: trendStart, to: monthEnd });

  const inMonth = expenses.filter((expense) => monthKey(expense.spentOn) === month);
  const previousMonth = monthKey(startOfMonth(monthStart, -1));
  const previousTotalCents = sum(
    expenses.filter((expense) => monthKey(expense.spentOn) === previousMonth),
  );

  const totalCents = sum(inMonth);
  const elapsedDays = daysElapsedInMonth(month);

  return {
    month,
    totalCents,
    previousTotalCents,
    changeRatio: previousTotalCents > 0 ? (totalCents - previousTotalCents) / previousTotalCents : null,
    expenseCount: inMonth.length,
    dailyAverageCents: elapsedDays ? Math.round(totalCents / elapsedDays) : 0,
    byCategory: groupByCategory(inMonth, totalCents),
    byMember: groupByMember(inMonth, memberIds),
    trend: buildTrend(expenses, month),
    topExpenses: [...inMonth].sort((a, b) => b.amountCents - a.amountCents).slice(0, 5),
  };
}

function groupByCategory(expenses: Expense[], totalCents: number): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountCents);
  }

  return EXPENSE_CATEGORIES.map((category) => category.id)
    .filter((id) => totals.has(id))
    .map((id) => ({
      id,
      amountCents: totals.get(id) ?? 0,
      ratio: totalCents > 0 ? (totals.get(id) ?? 0) / totalCents : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function groupByMember(expenses: Expense[], memberIds: Uuid[]): MemberSpending[] {
  const byUser = new Map<Uuid, MemberSpending>(
    memberIds.map((userId) => [userId, { userId, paidCents: 0, shareCents: 0 }]),
  );

  for (const expense of expenses) {
    const payer = byUser.get(expense.payerId);
    if (payer) payer.paidCents += expense.amountCents;
    for (const share of expense.shares) {
      const member = byUser.get(share.userId);
      if (member) member.shareCents += share.amountCents;
    }
  }

  return [...byUser.values()].sort((a, b) => b.shareCents - a.shareCents);
}

function buildTrend(expenses: Expense[], month: string): { month: string; amountCents: number }[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = monthKey(expense.spentOn);
    totals.set(key, (totals.get(key) ?? 0) + expense.amountCents);
  }

  return Array.from({ length: TREND_MONTHS }, (_, index) => {
    const key = monthKey(startOfMonth(`${month}-01`, index - (TREND_MONTHS - 1)));
    return { month: key, amountCents: totals.get(key) ?? 0 };
  });
}

/** Sur le mois courant on ne compte que les jours écoulés, pour une moyenne juste. */
function daysElapsedInMonth(month: string): number {
  const now = today();
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  return monthKey(now) === month ? Number(now.slice(8, 10)) : daysInMonth;
}

const sum = (expenses: Expense[]) =>
  expenses.reduce((total, expense) => total + expense.amountCents, 0);
