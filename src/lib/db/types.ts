/**
 * Types de la base, alignés sur `supabase/migrations/*.sql`.
 *
 * Écrits à la main pour rester lisibles. Après un changement de schéma on peut
 * les régénérer avec :
 *   npx supabase gen types typescript --project-id <ref> --schema public
 *
 * Important : ce sont des alias de types, pas des `interface`. Les interfaces
 * n'ont pas d'index signature implicite et ne satisfont donc pas la contrainte
 * `Record<string, unknown>` attendue par supabase-js — le client retomberait
 * silencieusement sur `never`.
 */

export type Uuid = string;
export type IsoDate = string; // 'YYYY-MM-DD'
export type IsoTimestamp = string;

export type MemberRole = 'owner' | 'member';
export type ChallengePurpose = 'registration' | 'authentication';

export type UserRow = {
  id: Uuid;
  email: string;
  display_name: string;
  avatar_color: string;
  current_household_id: Uuid | null;
  created_at: IsoTimestamp;
};

export type WebauthnCredentialRow = {
  id: string;
  user_id: Uuid;
  public_key: string;
  counter: number;
  transports: string[];
  device_type: string | null;
  backed_up: boolean;
  nickname: string | null;
  created_at: IsoTimestamp;
  last_used_at: IsoTimestamp | null;
};

export type WebauthnChallengeRow = {
  id: Uuid;
  challenge: string;
  purpose: ChallengePurpose;
  email: string | null;
  user_id: Uuid | null;
  expires_at: IsoTimestamp;
  created_at: IsoTimestamp;
};

export type HouseholdRow = {
  id: Uuid;
  name: string;
  invite_code: string;
  currency: string;
  created_by: Uuid | null;
  created_at: IsoTimestamp;
};

export type HouseholdMemberRow = {
  household_id: Uuid;
  user_id: Uuid;
  role: MemberRole;
  joined_at: IsoTimestamp;
};

export type ChoreRow = {
  id: Uuid;
  household_id: Uuid;
  title: string;
  emoji: string;
  effort: number;
  frequency_days: number;
  starts_on: IsoDate;
  archived_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
};

export type ChoreAssignmentRow = {
  id: Uuid;
  chore_id: Uuid;
  household_id: Uuid;
  assignee_id: Uuid;
  due_on: IsoDate;
  completed_at: IsoTimestamp | null;
  completed_by: Uuid | null;
  created_at: IsoTimestamp;
};

export type ExpenseRow = {
  id: Uuid;
  household_id: Uuid;
  payer_id: Uuid;
  amount_cents: number;
  description: string;
  category: string;
  spent_on: IsoDate;
  created_by: Uuid;
  created_at: IsoTimestamp;
};

export type ExpenseShareRow = {
  expense_id: Uuid;
  user_id: Uuid;
  amount_cents: number;
};

export type SettlementRow = {
  id: Uuid;
  household_id: Uuid;
  from_user_id: Uuid;
  to_user_id: Uuid;
  amount_cents: number;
  note: string | null;
  settled_on: IsoDate;
  created_by: Uuid;
  created_at: IsoTimestamp;
  /** Jeton d'intention du client : rejouer le même enregistrement ne duplique pas. */
  client_token: Uuid;
};

/** Une ligne de `household_balances()` — totaux agrégés en base. */
export type HouseholdBalanceRow = {
  user_id: Uuid;
  paid_cents: number;
  owed_cents: number;
  settled_out_cents: number;
  settled_in_cents: number;
};

/** Entrée de `create_expense_with_shares()`. */
export type ShareInput = {
  user_id: Uuid;
  amount_cents: number;
};

/** Entrée de `record_settlements()`. `client_token` absent → la base en tire un. */
export type SettlementInput = {
  from_user_id: Uuid;
  to_user_id: Uuid;
  amount_cents: number;
  note: string | null;
  settled_on: IsoDate;
  client_token: Uuid | null;
};

export type PushSubscriptionRow = {
  id: Uuid;
  user_id: Uuid;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: IsoTimestamp;
  last_seen_at: IsoTimestamp;
};

/** Colonnes toujours produites par Postgres. */
type Generated = 'id' | 'created_at' | 'joined_at' | 'last_seen_at';

/** Une colonne nullable a forcément un défaut (`null`) : elle est optionnelle. */
type NullableKeys<Row> = { [K in keyof Row]-?: null extends Row[K] ? K : never }[keyof Row];

type OptionalKeys<Row, Defaulted extends keyof Row> =
  | Extract<keyof Row, Generated>
  | NullableKeys<Row>
  | Defaulted;

/**
 * `Defaulted` liste les colonnes NOT NULL qui ont un `default` en base : elles
 * sont facultatives à l'insertion mais toujours présentes en lecture.
 */
type TableDef<Row extends Record<string, unknown>, Defaulted extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, OptionalKeys<Row, Defaulted>> &
    Partial<Pick<Row, OptionalKeys<Row, Defaulted>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<UserRow, 'avatar_color'>;
      webauthn_credentials: TableDef<
        WebauthnCredentialRow,
        'counter' | 'transports' | 'backed_up'
      >;
      webauthn_challenges: TableDef<WebauthnChallengeRow>;
      households: TableDef<HouseholdRow, 'currency'>;
      household_members: TableDef<HouseholdMemberRow, 'role'>;
      chores: TableDef<ChoreRow, 'emoji' | 'effort' | 'starts_on'>;
      chore_assignments: TableDef<ChoreAssignmentRow>;
      expenses: TableDef<ExpenseRow, 'category' | 'spent_on'>;
      expense_shares: TableDef<ExpenseShareRow>;
      settlements: TableDef<SettlementRow, 'settled_on' | 'client_token'>;
      push_subscriptions: TableDef<PushSubscriptionRow>;
    };
    Views: Record<string, never>;
    Functions: {
      delete_expired_webauthn_challenges: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      create_expense_with_shares: {
        Args: {
          p_id: Uuid;
          p_household_id: Uuid;
          p_payer_id: Uuid;
          p_amount_cents: number;
          p_description: string;
          p_category: string;
          p_spent_on: IsoDate;
          p_created_by: Uuid;
          p_shares: ShareInput[];
        };
        Returns: ExpenseRow;
      };
      household_balances: {
        Args: { p_household_id: Uuid };
        Returns: HouseholdBalanceRow[];
      };
      record_settlements: {
        Args: {
          p_household_id: Uuid;
          p_created_by: Uuid;
          p_settlements: SettlementInput[];
        };
        Returns: SettlementRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
