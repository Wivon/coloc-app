import 'server-only';

import { category } from '@/lib/categories';
import { addDays, monthKey, today } from '@/lib/date';
import type { Uuid } from '@/lib/db/types';
import { getBalanceSummary, listSettlements } from '@/lib/domain/balances';
import {
  generateSchedule,
  getWorkload,
  listAgenda,
  listChores,
  SCHEDULE_HORIZON_DAYS,
} from '@/lib/domain/chores';
import { listExpenses, type Expense } from '@/lib/domain/expenses';
import type { HouseholdContext } from '@/lib/domain/households';
import { getInsights } from '@/lib/domain/insights';
import { readDate, readFlag, readLimit, readMonth, readRange } from './params';

/**
 * Ressources de l'API personnelle, en lecture seule.
 *
 * Chacune passe par la même couche domaine que l'interface : les soldes sont
 * ceux de l'onglet Comptes, au centime près. Aucune ne reçoit d'identifiant de
 * colocation — elles lisent celle du porteur du jeton, ce qui rend l'isolation
 * structurelle plutôt que déclarative.
 *
 * Conventions de sortie, pensées pour un script plutôt que pour un modèle :
 * montants en **centimes entiers** (`*_cents`) avec la devise à côté, dates
 * AAAA-MM-JJ, clés en snake_case, identifiants de colocs accompagnés de leur nom.
 */

export type Resource = (ctx: HouseholdContext, params: URLSearchParams) => Promise<unknown>;

const MAX_EXPENSES = 1000;
const MAX_SETTLEMENTS = 500;
const MAX_TASK_DAYS = 120;

// ---------------------------------------------------------------------------
// Colocation
// ---------------------------------------------------------------------------

const household: Resource = async (ctx) => ({
  household: {
    id: ctx.household.id,
    name: ctx.household.name,
    currency: ctx.household.currency,
    created_at: ctx.household.created_at,
  },
  me: { id: ctx.user.id, name: ctx.user.display_name, email: ctx.user.email },
  members: ctx.members.map((member) => ({
    id: member.id,
    name: member.displayName,
    email: member.email,
    role: member.role,
    is_me: member.id === ctx.user.id,
  })),
});

// ---------------------------------------------------------------------------
// Dépenses
// ---------------------------------------------------------------------------

const expenses: Resource = async (ctx, params) => {
  const from = readDate(params, 'from');
  const to = readDate(params, 'to');
  const limit = readLimit(params, 'limit', 50, MAX_EXPENSES);

  // Avec une période, on lit tout l'intervalle puis on coupe : demander « les N
  // plus récentes » à la base ne dirait pas s'il en reste. `has_more` le dit.
  const ranged = Boolean(from || to);
  const rows = await listExpenses(ctx.household.id, {
    from,
    to,
    limit: ranged ? undefined : limit + 1,
  });

  return {
    currency: ctx.household.currency,
    count: Math.min(rows.length, limit),
    has_more: rows.length > limit,
    expenses: rows.slice(0, limit).map((expense) => serializeExpense(ctx, expense)),
  };
};

function serializeExpense(ctx: HouseholdContext, expense: Expense) {
  return {
    id: expense.id,
    date: expense.spentOn,
    description: expense.description,
    category: expense.category,
    category_label: category(expense.category).label,
    amount_cents: expense.amountCents,
    payer_id: expense.payerId,
    payer_name: nameOf(ctx, expense.payerId),
    created_by: expense.createdBy,
    shares: expense.shares.map((share) => ({
      user_id: share.userId,
      name: nameOf(ctx, share.userId),
      amount_cents: share.amountCents,
    })),
    my_share_cents:
      expense.shares.find((share) => share.userId === ctx.user.id)?.amountCents ?? 0,
  };
}

const stats: Resource = async (ctx, params) => {
  const month = readMonth(params, 'month') ?? monthKey(today());
  const insights = await getInsights(
    ctx.household.id,
    ctx.members.map((member) => member.id),
    month,
  );

  return {
    currency: ctx.household.currency,
    month,
    total_cents: insights.totalCents,
    previous_month_total_cents: insights.previousTotalCents,
    change_ratio: insights.changeRatio,
    expense_count: insights.expenseCount,
    daily_average_cents: insights.dailyAverageCents,
    by_category: insights.byCategory.map((slice) => ({
      category: slice.id,
      category_label: category(slice.id).label,
      amount_cents: slice.amountCents,
      ratio: slice.ratio,
    })),
    by_member: insights.byMember.map((entry) => ({
      user_id: entry.userId,
      name: nameOf(ctx, entry.userId),
      // « Avancé » n'est pas « consommé » : le premier dit qui a sorti l'argent,
      // le second ce que la personne a réellement dépensé pour elle.
      paid_cents: entry.paidCents,
      share_cents: entry.shareCents,
    })),
    trend: insights.trend.map((point) => ({ month: point.month, amount_cents: point.amountCents })),
    top_expenses: insights.topExpenses.map((expense) => serializeExpense(ctx, expense)),
  };
};

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

const balances: Resource = async (ctx) => {
  const summary = await getBalanceSummary(
    ctx.household.id,
    ctx.members.map((member) => member.id),
  );

  const transfer = (item: { fromUserId: Uuid; toUserId: Uuid; amountCents: number }) => ({
    from_user_id: item.fromUserId,
    from_name: nameOf(ctx, item.fromUserId),
    to_user_id: item.toUserId,
    to_name: nameOf(ctx, item.toUserId),
    amount_cents: item.amountCents,
  });

  const mine = summary.balances.find((balance) => balance.userId === ctx.user.id);

  return {
    currency: ctx.household.currency,
    balances: summary.balances.map((balance) => ({
      user_id: balance.userId,
      name: nameOf(ctx, balance.userId),
      net_cents: balance.netCents,
      paid_cents: balance.paidCents,
      owed_cents: balance.owedCents,
      settled_out_cents: balance.settledOutCents,
      settled_in_cents: balance.settledInCents,
    })),
    // Déjà simplifiés : au plus n−1 virements pour n colocs.
    transfers: summary.transfers.map(transfer),
    me: {
      net_cents: mine?.netCents ?? 0,
      i_owe: summary.transfers.filter((t) => t.fromUserId === ctx.user.id).map(transfer),
      owed_to_me: summary.transfers.filter((t) => t.toUserId === ctx.user.id).map(transfer),
    },
  };
};

const settlements: Resource = async (ctx, params) => {
  const rows = await listSettlements(
    ctx.household.id,
    readLimit(params, 'limit', 50, MAX_SETTLEMENTS),
  );

  return {
    currency: ctx.household.currency,
    settlements: rows.map((row) => ({
      id: row.id,
      date: row.settled_on,
      from_user_id: row.from_user_id,
      from_name: nameOf(ctx, row.from_user_id),
      to_user_id: row.to_user_id,
      to_name: nameOf(ctx, row.to_user_id),
      amount_cents: row.amount_cents,
      note: row.note,
      created_at: row.created_at,
    })),
  };
};

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

const tasks: Resource = async (ctx, params) => {
  // 14 jours en arrière par défaut, pour ne pas masquer le retard.
  const range = readRange(
    params,
    { from: addDays(today(), -14), to: addDays(today(), SCHEDULE_HORIZON_DAYS) },
    MAX_TASK_DAYS,
  );
  const mineOnly = readFlag(params, 'mine');
  const includeDone = readFlag(params, 'include_done');

  // Complète le planning avant de lire, comme le fait l'onglet Tâches : sans
  // cela, l'API montrerait un agenda vide là où l'application en affiche un.
  // Idempotent — aucune échéance n'est créée deux fois.
  await generateSchedule(ctx.household.id);
  const items = await listAgenda(ctx.household.id, range);

  return {
    today: today(),
    from: range.from,
    to: range.to,
    tasks: items
      .filter((item) => includeDone || !item.completedAt)
      .filter((item) => !mineOnly || item.assigneeId === ctx.user.id)
      .map((item) => ({
        id: item.id,
        chore_id: item.choreId,
        title: item.title,
        emoji: item.emoji,
        effort: item.effort,
        due_on: item.dueOn,
        assignee_id: item.assigneeId,
        assignee_name: nameOf(ctx, item.assigneeId),
        done: Boolean(item.completedAt),
        completed_at: item.completedAt,
        late: !item.completedAt && item.dueOn < today(),
      })),
  };
};

const chores: Resource = async (ctx) => {
  const [rows, workload] = await Promise.all([
    listChores(ctx.household.id),
    getWorkload(ctx.household.id),
  ]);

  return {
    chores: rows.map((chore) => ({
      id: chore.id,
      title: chore.title,
      emoji: chore.emoji,
      effort: chore.effort,
      frequency_days: chore.frequency_days,
      starts_on: chore.starts_on,
    })),
    // Fenêtre glissante : 30 jours passés et l'horizon de planning à venir.
    workload: workload.map((entry) => ({
      user_id: entry.member.id,
      name: entry.member.displayName,
      done_effort: entry.done,
      pending_effort: entry.pending,
    })),
  };
};

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------

/** Tout l'essentiel en un appel : de quoi alimenter un widget ou un tableau de bord. */
const summary: Resource = async (ctx) => {
  const none = new URLSearchParams();
  const nextWeek = new URLSearchParams({ from: today(), to: addDays(today(), 7) });

  const [h, b, s, e, t] = await Promise.all([
    household(ctx, none),
    balances(ctx, none),
    stats(ctx, none),
    expenses(ctx, new URLSearchParams({ limit: '10' })),
    tasks(ctx, nextWeek),
  ]);

  return { ...(h as object), balances: b, month: s, recent_expenses: e, upcoming_tasks: t };
};

export const RESOURCES: Record<string, Resource> = {
  summary,
  household,
  expenses,
  stats,
  balances,
  settlements,
  tasks,
  chores,
};

function nameOf(ctx: HouseholdContext, userId: Uuid): string {
  return ctx.members.find((member) => member.id === userId)?.displayName ?? 'Ancien coloc';
}
