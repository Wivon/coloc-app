-- ColocApp — schéma initial
--
-- Toutes les tables vivent dans `public` mais sont fermées : RLS est activé sans
-- aucune policy, donc les clés publiques (anon / publishable) ne peuvent rien lire.
-- L'application accède à la base uniquement côté serveur avec la clé service_role,
-- et l'autorisation est faite dans `src/lib/db/*` (voir `assertMembership`).

create extension if not exists "pgcrypto" with schema extensions;
-- `citext` vit hors de `public` (recommandation du linter Supabase) ; le schéma
-- `extensions` fait partie du search_path par défaut, les colonnes citext
-- s'utilisent donc sans qualification.
create extension if not exists "citext" with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilisateurs & passkeys
-- ---------------------------------------------------------------------------

create table public.users (
  id                   uuid primary key default gen_random_uuid(),
  email                citext not null unique,
  display_name         text not null,
  avatar_color         text not null default 'moss',
  current_household_id uuid,
  created_at           timestamptz not null default now()
);

create table public.webauthn_credentials (
  id            text primary key,               -- credential ID (base64url)
  user_id       uuid not null references public.users (id) on delete cascade,
  public_key    text not null,                  -- COSE public key (base64url)
  counter       bigint not null default 0,
  transports    text[] not null default '{}',
  device_type   text,
  backed_up     boolean not null default false,
  nickname      text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index webauthn_credentials_user_id_idx on public.webauthn_credentials (user_id);

-- Challenges éphémères (registration + authentication). Nettoyés à l'usage et
-- par `delete_expired_webauthn_challenges()`.
create table public.webauthn_challenges (
  id         uuid primary key default gen_random_uuid(),
  challenge  text not null,
  purpose    text not null check (purpose in ('registration', 'authentication')),
  email      citext,
  user_id    uuid references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index webauthn_challenges_expires_at_idx on public.webauthn_challenges (expires_at);

-- ---------------------------------------------------------------------------
-- Colocations
-- ---------------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  currency    text not null default 'EUR',
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members (user_id);

alter table public.users
  add constraint users_current_household_id_fkey
  foreign key (current_household_id) references public.households (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Tâches
-- ---------------------------------------------------------------------------

create table public.chores (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  title          text not null,
  emoji          text not null default '🧽',
  -- Poids de la tâche, utilisé pour équilibrer la charge entre colocs.
  effort         smallint not null default 1 check (effort between 1 and 5),
  frequency_days smallint not null check (frequency_days between 1 and 90),
  starts_on      date not null default current_date,
  archived_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index chores_household_id_idx on public.chores (household_id);

create table public.chore_assignments (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid not null references public.chores (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  assignee_id  uuid not null references public.users (id) on delete cascade,
  due_on       date not null,
  completed_at timestamptz,
  completed_by uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (chore_id, due_on)
);
create index chore_assignments_household_due_idx on public.chore_assignments (household_id, due_on);
create index chore_assignments_assignee_idx on public.chore_assignments (assignee_id, due_on);

-- ---------------------------------------------------------------------------
-- Dépenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  payer_id     uuid not null references public.users (id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  description  text not null,
  category     text not null default 'other',
  spent_on     date not null default current_date,
  created_by   uuid not null references public.users (id),
  created_at   timestamptz not null default now()
);
create index expenses_household_spent_on_idx on public.expenses (household_id, spent_on desc);

-- Une ligne par coloc concerné. La somme des parts = expenses.amount_cents
-- (garanti par l'application, voir `splitEvenly`).
create table public.expense_shares (
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  primary key (expense_id, user_id)
);
create index expense_shares_user_id_idx on public.expense_shares (user_id);

-- ---------------------------------------------------------------------------
-- Remboursements
-- ---------------------------------------------------------------------------

create table public.settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_user_id uuid not null references public.users (id),
  to_user_id   uuid not null references public.users (id),
  amount_cents bigint not null check (amount_cents > 0),
  note         text,
  settled_on   date not null default current_date,
  created_by   uuid not null references public.users (id),
  created_at   timestamptz not null default now(),
  constraint settlements_distinct_parties check (from_user_id <> to_user_id)
);
create index settlements_household_idx on public.settlements (household_id, settled_on desc);

-- ---------------------------------------------------------------------------
-- Notifications push (Web Push / VAPID)
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Verrouillage : RLS activé partout, aucune policy → seule la clé service_role
-- (utilisée uniquement côté serveur) peut lire/écrire.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'webauthn_credentials', 'webauthn_challenges',
    'households', 'household_members',
    'chores', 'chore_assignments',
    'expenses', 'expense_shares', 'settlements',
    'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Entretien
-- ---------------------------------------------------------------------------

create or replace function public.delete_expired_webauthn_challenges()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.webauthn_challenges where expires_at < now();
$$;

revoke all on function public.delete_expired_webauthn_challenges() from public, anon, authenticated;
