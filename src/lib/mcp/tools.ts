import 'server-only';
import { z } from 'zod';

import { EXPENSE_CATEGORIES, category, isExpenseCategory, type ExpenseCategoryId } from '@/lib/categories';
import { addDays, formatMonthLabel, formatShortDate, today } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { HouseholdRow, UserRow, Uuid } from '@/lib/db/types';
import {
  getBalanceSummary,
  listSettlements,
  recordSettlements,
} from '@/lib/domain/balances';
import {
  archiveChore,
  createChore,
  generateSchedule,
  getWorkload,
  listAgenda,
  reassign,
  rebalanceSchedule,
  setAssignmentDone,
  SCHEDULE_HORIZON_DAYS,
} from '@/lib/domain/chores';
import { createExpense, deleteExpense, getExpense, listExpenses } from '@/lib/domain/expenses';
import type { Member } from '@/lib/domain/households';
import { getInsights } from '@/lib/domain/insights';
import { notifyInBackground } from '@/lib/domain/push';
import type { McpIdentity } from '@/lib/domain/mcp-tokens';
import type { McpServer, ToolDescriptor } from './protocol';
import { parseAmount, parseDate, parseMonth, resolveMemberId, resolveMemberIds } from './inputs';

/**
 * Les outils exposés à l'assistant.
 *
 * Chacun passe par la même couche domaine que l'interface — mêmes règles, mêmes
 * garanties d'intégrité, mêmes notifications aux colocs. Un outil ne reçoit
 * jamais d'identifiant de colocation : il agit dans celle de son porteur, ce qui
 * rend l'isolation structurelle plutôt que déclarative.
 *
 * Les outils rendent du texte : du JSON pour les lectures — un modèle le relit
 * sans ambiguïté — et une phrase pour les écritures, qui se répète telle quelle à
 * l'utilisateur.
 */

const SERVER_NAME = 'colocapp';
const SERVER_VERSION = '1.0.0';

/** Plafond de lecture : au-delà, la réponse encombre le contexte sans servir. */
const MAX_ROWS = 100;

export interface ToolContext {
  user: UserRow;
  household: HouseholdRow;
  members: Member[];
}

const CATEGORY_IDS = EXPENSE_CATEGORIES.map((entry) => entry.id) as [
  ExpenseCategoryId,
  ...ExpenseCategoryId[],
];

const MEMBER_HINT = 'Nom, prénom, email ou identifiant d’un coloc. « moi » pour vous-même.';

// ---------------------------------------------------------------------------
// Colocation
// ---------------------------------------------------------------------------

const getHousehold = tool({
  name: 'get_household',
  description:
    'Colocation de l’utilisateur : nom, devise, liste des colocs avec leurs identifiants. À appeler en premier pour savoir qui compose la coloc.',
  input: z.object({}),
  async run(_args, ctx) {
    return json({
      household: { name: ctx.household.name, currency: ctx.household.currency },
      me: { id: ctx.user.id, name: ctx.user.display_name, email: ctx.user.email },
      members: ctx.members.map((member) => ({
        id: member.id,
        name: member.displayName,
        email: member.email,
        role: member.role,
      })),
      today: today(),
    });
  },
});

// ---------------------------------------------------------------------------
// Dépenses
// ---------------------------------------------------------------------------

const addExpense = tool({
  name: 'add_expense',
  description:
    'Ajoute une dépense partagée. Par défaut elle est payée par l’utilisateur et partagée à parts égales entre tous les colocs.',
  input: z.object({
    description: z.string().min(1).max(120).describe('Libellé court, ex. « Courses Carrefour ».'),
    amount: z.union([z.number(), z.string()]).describe('Montant total payé, en euros. Ex. 24.5'),
    payer: z.string().optional().describe(`Qui a avancé l’argent. ${MEMBER_HINT} Défaut : vous.`),
    participants: z
      .array(z.string())
      .optional()
      .describe('Colocs qui partagent la dépense. Défaut : toute la colocation.'),
    category: z.enum(CATEGORY_IDS).optional().describe('Catégorie. Défaut : other.'),
    date: z.string().optional().describe('Date de la dépense, AAAA-MM-JJ. Défaut : aujourd’hui.'),
  }),
  async run(args, ctx) {
    const amountCents = parseAmount(args.amount);
    const payerId = resolveMemberId(ctx.members, args.payer, ctx.user.id);
    const participantIds = resolveMemberIds(ctx.members, args.participants, ctx.user.id);
    const spentOn = parseDate(args.date);

    // Même tolérance d'un jour que le formulaire : l'assistant peut raisonner
    // dans le fuseau de l'utilisateur pendant que le serveur tourne en UTC.
    if (spentOn > addDays(today(), 1)) throw new Error('La date ne peut pas être dans le futur.');

    const description = args.description.trim();
    if (!description) throw new Error('Ajoutez un libellé.');

    const expense = await createExpense(ctx.household.id, ctx.user.id, {
      payerId,
      amountCents,
      description,
      category: args.category && isExpenseCategory(args.category) ? args.category : 'other',
      spentOn,
      participantIds,
    });

    // Mêmes notifications que depuis l'app : un coloc ne doit pas découvrir une
    // dépense plus tard simplement parce qu'elle est passée par un assistant.
    notifyInBackground(
      participantIds.filter((id) => id !== ctx.user.id),
      {
        title: `${description} · ${money(ctx, amountCents)}`,
        body: `${nameOf(ctx, payerId)} a ajouté une dépense partagée.`,
        url: '/expenses',
        tag: 'expense',
      },
    );

    const share = expense.shares.find((entry) => entry.userId === ctx.user.id);
    return [
      `Dépense enregistrée : « ${description} » · ${money(ctx, amountCents)}`,
      `payée par ${nameOf(ctx, payerId)}, partagée entre ${participantIds.length} coloc(s)`,
      share ? `— votre part : ${money(ctx, share.amountCents)}.` : '— vous n’êtes pas concerné.',
      `(id ${expense.id})`,
    ].join(' ');
  },
});

const listExpensesTool = tool({
  name: 'list_expenses',
  description:
    'Dépenses de la colocation, de la plus récente à la plus ancienne. Sans période, renvoie les dernières.',
  input: z.object({
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe('Défaut : 20.'),
    from: z.string().optional().describe('Début de période, AAAA-MM-JJ (incluse).'),
    to: z.string().optional().describe('Fin de période, AAAA-MM-JJ (incluse).'),
  }),
  async run(args, ctx) {
    const limit = args.limit ?? 20;

    // Avec une période, on lit tout l'intervalle puis on coupe : demander à la
    // base « les 20 plus récentes » d'une période tronquerait le début sans le
    // dire, et l'assistant conclurait à partir d'un extrait qu'il croit complet.
    const ranged = Boolean(args.from || args.to);
    const expenses = await listExpenses(ctx.household.id, {
      from: args.from ? parseDate(args.from) : undefined,
      to: args.to ? parseDate(args.to) : undefined,
      ...(ranged ? {} : { limit }),
    });

    return json({
      total_in_range: ranged ? expenses.length : undefined,
      expenses: expenses.slice(0, limit).map((expense) => ({
        id: expense.id,
        date: expense.spentOn,
        description: expense.description,
        category: category(expense.category).label,
        amount: euros(expense.amountCents),
        amount_label: money(ctx, expense.amountCents),
        payer: nameOf(ctx, expense.payerId),
        participants: expense.shares.map((share) => nameOf(ctx, share.userId)),
        my_share: euros(
          expense.shares.find((share) => share.userId === ctx.user.id)?.amountCents ?? 0,
        ),
      })),
    });
  },
});

const deleteExpenseTool = tool({
  name: 'delete_expense',
  description:
    'Supprime une dépense saisie par erreur. Irréversible — l’identifiant vient de list_expenses.',
  input: z.object({ expense_id: z.string().describe('Identifiant renvoyé par list_expenses.') }),
  async run(args, ctx) {
    const expense = await getExpense(ctx.household.id, args.expense_id);
    if (!expense) throw new Error('Dépense introuvable dans cette colocation.');

    await deleteExpense(ctx.household.id, args.expense_id);
    return `Dépense supprimée : « ${expense.description} » · ${money(ctx, expense.amountCents)} du ${formatShortDate(expense.spentOn)}.`;
  },
});

const getExpenseStats = tool({
  name: 'get_expense_stats',
  description:
    'Statistiques de dépenses d’un mois : total, évolution, répartition par catégorie et par coloc, tendance sur 6 mois.',
  input: z.object({
    month: z.string().optional().describe('Mois AAAA-MM. Défaut : mois en cours.'),
  }),
  async run(args, ctx) {
    const month = parseMonth(args.month);
    const insights = await getInsights(
      ctx.household.id,
      ctx.members.map((member) => member.id),
      month,
    );

    return json({
      month: formatMonthLabel(month),
      total: euros(insights.totalCents),
      total_label: money(ctx, insights.totalCents),
      previous_month_total: euros(insights.previousTotalCents),
      change_vs_previous_month:
        insights.changeRatio === null ? null : `${Math.round(insights.changeRatio * 100)} %`,
      expense_count: insights.expenseCount,
      daily_average: euros(insights.dailyAverageCents),
      by_category: insights.byCategory.map((slice) => ({
        category: category(slice.id).label,
        amount: euros(slice.amountCents),
        share: `${Math.round(slice.ratio * 100)} %`,
      })),
      by_member: insights.byMember.map((entry) => ({
        member: nameOf(ctx, entry.userId),
        // « Avancé » n'est pas « consommé » : le premier dit qui a sorti l'argent,
        // le second ce que la personne a réellement dépensé pour elle.
        paid: euros(entry.paidCents),
        share: euros(entry.shareCents),
      })),
      trend: insights.trend.map((point) => ({
        month: point.month,
        amount: euros(point.amountCents),
      })),
      top_expenses: insights.topExpenses.map((expense) => ({
        description: expense.description,
        amount: euros(expense.amountCents),
        payer: nameOf(ctx, expense.payerId),
      })),
    });
  },
});

// ---------------------------------------------------------------------------
// Comptes et remboursements
// ---------------------------------------------------------------------------

const getBalances = tool({
  name: 'get_balances',
  description:
    'Soldes de la colocation et virements à effectuer pour tout remettre à plat : qui doit combien à qui, y compris ce que l’utilisateur doit et ce qu’on lui doit.',
  input: z.object({}),
  async run(_args, ctx) {
    const summary = await getBalanceSummary(
      ctx.household.id,
      ctx.members.map((member) => member.id),
    );

    const transfer = (item: { fromUserId: Uuid; toUserId: Uuid; amountCents: number }) => ({
      from: nameOf(ctx, item.fromUserId),
      to: nameOf(ctx, item.toUserId),
      amount: euros(item.amountCents),
      amount_label: money(ctx, item.amountCents),
    });

    return json({
      currency: ctx.household.currency,
      balances: summary.balances.map((balance) => ({
        member: nameOf(ctx, balance.userId),
        net: euros(balance.netCents),
        net_label: money(ctx, balance.netCents, { signed: true }),
        status:
          balance.netCents > 0
            ? 'on lui doit de l’argent'
            : balance.netCents < 0
              ? 'doit de l’argent'
              : 'à l’équilibre',
        paid: euros(balance.paidCents),
        owed: euros(balance.owedCents),
      })),
      // Les virements sont déjà simplifiés : au plus n−1 pour n colocs.
      transfers: summary.transfers.map(transfer),
      i_owe: summary.transfers.filter((t) => t.fromUserId === ctx.user.id).map(transfer),
      owed_to_me: summary.transfers.filter((t) => t.toUserId === ctx.user.id).map(transfer),
    });
  },
});

const recordSettlement = tool({
  name: 'record_settlement',
  description:
    'Enregistre un remboursement déjà versé entre deux colocs. Cela ne supprime aucune dépense : le versement entre dans le calcul des soldes.',
  input: z.object({
    to: z.string().describe(`Bénéficiaire du remboursement. ${MEMBER_HINT}`),
    amount: z.union([z.number(), z.string()]).describe('Montant versé, en euros.'),
    from: z.string().optional().describe(`Qui a payé. ${MEMBER_HINT} Défaut : vous.`),
    note: z.string().max(120).optional(),
    date: z.string().optional().describe('Date du virement, AAAA-MM-JJ. Défaut : aujourd’hui.'),
  }),
  async run(args, ctx) {
    const fromUserId = resolveMemberId(ctx.members, args.from, ctx.user.id);
    const toUserId = resolveMemberId(ctx.members, args.to, ctx.user.id);
    const amountCents = parseAmount(args.amount);

    await recordSettlements(ctx.household.id, ctx.user.id, [
      {
        fromUserId,
        toUserId,
        amountCents,
        note: args.note ?? 'Remboursement',
        settledOn: parseDate(args.date),
      },
    ]);

    notifyInBackground(toUserId === ctx.user.id ? [] : [toUserId], {
      title: `Remboursement de ${money(ctx, amountCents)}`,
      body: `${nameOf(ctx, fromUserId)} a enregistré un remboursement.`,
      url: '/balances',
      tag: 'settlement',
    });

    return `Remboursement enregistré : ${nameOf(ctx, fromUserId)} → ${nameOf(ctx, toUserId)} · ${money(ctx, amountCents)}.`;
  },
});

const settleAll = tool({
  name: 'settle_all',
  description:
    'Enregistre d’un coup tous les remboursements que l’utilisateur doit encore effectuer, aux montants recalculés à l’instant.',
  input: z.object({}),
  async run(_args, ctx) {
    const { transfers } = await getBalanceSummary(
      ctx.household.id,
      ctx.members.map((member) => member.id),
    );
    const mine = transfers.filter((entry) => entry.fromUserId === ctx.user.id);
    if (mine.length === 0) return 'Rien à régler : vous ne devez d’argent à personne.';

    // Comme le bouton « Tout régler » : montants recalculés, donc pas de jeton
    // d'intention — après un premier succès il ne reste plus rien à solder.
    await recordSettlements(
      ctx.household.id,
      ctx.user.id,
      mine.map((entry) => ({
        fromUserId: ctx.user.id,
        toUserId: entry.toUserId,
        amountCents: entry.amountCents,
        note: 'Solde du mois',
      })),
    );

    for (const entry of mine) {
      notifyInBackground([entry.toUserId], {
        title: `Remboursement de ${money(ctx, entry.amountCents)}`,
        body: `${ctx.user.display_name} a soldé ses comptes.`,
        url: '/balances',
        tag: 'settlement',
      });
    }

    return `${mine.length} remboursement(s) enregistré(s) : ${mine
      .map((entry) => `${nameOf(ctx, entry.toUserId)} ${money(ctx, entry.amountCents)}`)
      .join(', ')}.`;
  },
});

const listSettlementsTool = tool({
  name: 'list_settlements',
  description: 'Remboursements déjà enregistrés, du plus récent au plus ancien.',
  input: z.object({
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe('Défaut : 20.'),
  }),
  async run(args, ctx) {
    const rows = await listSettlements(ctx.household.id, args.limit ?? 20);

    return json({
      settlements: rows.map((row) => ({
        id: row.id,
        date: row.settled_on,
        from: nameOf(ctx, row.from_user_id),
        to: nameOf(ctx, row.to_user_id),
        amount: euros(row.amount_cents),
        amount_label: money(ctx, row.amount_cents),
        note: row.note,
      })),
    });
  },
});

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

const listTasks = tool({
  name: 'list_tasks',
  description:
    'Échéances de tâches ménagères : en retard, du jour et à venir, avec le coloc à qui chacune revient.',
  input: z.object({
    days: z.number().int().min(1).max(90).optional().describe(`Horizon en jours. Défaut : ${SCHEDULE_HORIZON_DAYS}.`),
    mine_only: z.boolean().optional().describe('Ne garder que vos tâches. Défaut : false.'),
    include_done: z.boolean().optional().describe('Inclure les tâches déjà faites. Défaut : false.'),
  }),
  async run(args, ctx) {
    // Complète le planning avant de lire, comme l'onglet Tâches. Idempotent.
    await generateSchedule(ctx.household.id);

    const items = await listAgenda(ctx.household.id, {
      // On remonte 14 jours en arrière pour ne pas masquer le retard.
      from: addDays(today(), -14),
      to: addDays(today(), args.days ?? SCHEDULE_HORIZON_DAYS),
    });

    const visible = items
      .filter((item) => (args.include_done ? true : !item.completedAt))
      .filter((item) => (args.mine_only ? item.assigneeId === ctx.user.id : true));

    return json({
      today: today(),
      tasks: visible.slice(0, MAX_ROWS).map((item) => ({
        task_id: item.id,
        chore_id: item.choreId,
        title: `${item.emoji} ${item.title}`,
        due_on: item.dueOn,
        late: !item.completedAt && item.dueOn < today(),
        assignee: nameOf(ctx, item.assigneeId),
        done: Boolean(item.completedAt),
        effort: item.effort,
      })),
    });
  },
});

const addTask = tool({
  name: 'add_task',
  description:
    'Crée une tâche récurrente. Elle est aussitôt répartie entre les colocs selon leur charge, sur les trois semaines à venir.',
  input: z.object({
    title: z.string().min(2).max(80).describe('Ex. « Sortir les poubelles ».'),
    frequency_days: z
      .number()
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe('Tous les combien de jours. Défaut : 7.'),
    effort: z.number().int().min(1).max(5).optional().describe('Poids de la tâche, 1 à 5. Défaut : 1.'),
    emoji: z.string().max(4).optional().describe('Défaut : 🧽.'),
  }),
  async run(args, ctx) {
    const chore = await createChore(ctx.household.id, {
      title: args.title.trim(),
      emoji: args.emoji || '🧽',
      effort: args.effort ?? 1,
      frequencyDays: args.frequency_days ?? 7,
    });

    return `Tâche créée : ${chore.emoji} ${chore.title}, tous les ${chore.frequency_days} jour(s), effort ${chore.effort}. Elle est répartie automatiquement (chore_id ${chore.id}).`;
  },
});

const completeTask = tool({
  name: 'complete_task',
  description:
    'Coche (ou décoche) une échéance de tâche. L’identifiant est le champ task_id renvoyé par list_tasks.',
  input: z.object({
    task_id: z.string().describe('Champ task_id de list_tasks — une échéance, pas la tâche récurrente.'),
    done: z.boolean().optional().describe('Défaut : true.'),
  }),
  async run(args, ctx) {
    const done = args.done ?? true;
    await setAssignmentDone(ctx.household.id, args.task_id, ctx.user.id, done);
    return done ? 'Tâche marquée comme faite.' : 'Tâche remise à faire.';
  },
});

const reassignTask = tool({
  name: 'reassign_task',
  description: 'Confie une échéance de tâche à un autre coloc.',
  input: z.object({
    task_id: z.string().describe('Champ task_id de list_tasks.'),
    assignee: z.string().describe(`Nouveau responsable. ${MEMBER_HINT}`),
  }),
  async run(args, ctx) {
    const assigneeId = resolveMemberId(ctx.members, args.assignee, ctx.user.id);
    await reassign(ctx.household.id, args.task_id, assigneeId);

    if (assigneeId !== ctx.user.id) {
      notifyInBackground([assigneeId], {
        title: 'Nouvelle tâche pour toi',
        body: `${ctx.user.display_name} t’a confié une tâche.`,
        url: '/tasks',
        tag: 'chore-reassign',
      });
    }

    return `Tâche confiée à ${nameOf(ctx, assigneeId)}.`;
  },
});

const deleteTask = tool({
  name: 'delete_task',
  description:
    'Archive une tâche récurrente : ses échéances à venir disparaissent, l’historique reste. L’identifiant est le champ chore_id de list_tasks.',
  input: z.object({ chore_id: z.string().describe('Champ chore_id de list_tasks.') }),
  async run(args, ctx) {
    await archiveChore(ctx.household.id, args.chore_id);
    return 'Tâche archivée : elle ne sera plus planifiée.';
  },
});

const rebalanceTasks = tool({
  name: 'rebalance_tasks',
  description:
    'Efface les échéances à venir non faites et relance une répartition complète, équilibrée selon la charge de chacun.',
  input: z.object({}),
  async run(_args, ctx) {
    const created = await rebalanceSchedule(ctx.household.id);
    return `Planning refait : ${created} échéance(s) réparties.`;
  },
});

const getWorkloadTool = tool({
  name: 'get_workload',
  description:
    'Charge de travail par coloc sur la fenêtre glissante : effort déjà fait et effort restant.',
  input: z.object({}),
  async run(_args, ctx) {
    const workload = await getWorkload(ctx.household.id);
    return json({
      workload: workload.map((entry) => ({
        member: entry.member.displayName,
        done_effort: entry.done,
        pending_effort: entry.pending,
      })),
    });
  },
});

const TOOLS = [
  getHousehold,
  addExpense,
  listExpensesTool,
  deleteExpenseTool,
  getExpenseStats,
  getBalances,
  recordSettlement,
  settleAll,
  listSettlementsTool,
  listTasks,
  addTask,
  completeTask,
  reassignTask,
  deleteTask,
  rebalanceTasks,
  getWorkloadTool,
];

/** Serveur MCP d'un porteur de jeton : ses outils agissent en son nom. */
export function createMcpServer(identity: McpIdentity): McpServer {
  const ctx: ToolContext = identity;
  const byName = new Map(TOOLS.map((entry) => [entry.name, entry]));

  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    instructions: [
      `Tu agis dans ColocApp au nom de ${identity.user.display_name}, coloc de « ${identity.household.name} ».`,
      `Colocs : ${identity.members.map((member) => member.displayName).join(', ')}.`,
      'Les montants sont en euros. Les dates sont au format AAAA-MM-JJ.',
      'Les identifiants (dépense, tâche) viennent des outils de lecture : commence par eux plutôt que de les inventer.',
      'Une dépense est partagée avec toute la colocation sauf indication contraire.',
    ].join(' '),
    tools: TOOLS.map(({ name, description, inputSchema }): ToolDescriptor => ({
      name,
      description,
      inputSchema,
    })),
    async callTool(name, args) {
      const entry = byName.get(name);
      if (!entry) throw new Error(`Outil inconnu : ${name}`);
      return entry.run(args, ctx);
    },
  };
}

// ---------------------------------------------------------------------------
// Plomberie
// ---------------------------------------------------------------------------

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

/**
 * Déclare un outil : le schéma zod sert à la fois de documentation pour le modèle
 * (converti en JSON Schema) et de validation à l'exécution — un modèle envoie
 * régulièrement une chaîne là où un nombre est attendu, ou oublie un argument.
 */
function tool<S extends z.ZodType>(definition: {
  name: string;
  description: string;
  input: S;
  run: (args: z.output<S>, ctx: ToolContext) => Promise<string>;
}): Tool {
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: jsonSchema(definition.input),
    run: (args, ctx) => definition.run(parseArgs(definition.input, args, definition.name), ctx),
  };
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema) as Record<string, unknown>;
  // `$schema` n'apporte rien au client MCP et alourdit chaque `tools/list`.
  delete generated.$schema;
  return generated;
}

function parseArgs<S extends z.ZodType>(schema: S, args: unknown, name: string): z.output<S> {
  const result = schema.safeParse(args ?? {});
  if (result.success) return result.data;

  // Message lisible par le modèle : il corrige et rappelle l'outil.
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'argument'} : ${issue.message}`)
    .join(' ; ');
  throw new Error(`Arguments invalides pour ${name} — ${details}`);
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Les montants sortent en euros : un modèle raisonne mal en centimes. */
const euros = (cents: number) => Math.round(cents) / 100;

function money(ctx: ToolContext, cents: number, options?: { signed?: boolean }): string {
  return formatMoney(cents, ctx.household.currency, options);
}

function nameOf(ctx: ToolContext, userId: Uuid): string {
  if (userId === ctx.user.id) return `${ctx.user.display_name} (vous)`;
  return ctx.members.find((member) => member.id === userId)?.displayName ?? 'Ancien coloc';
}
