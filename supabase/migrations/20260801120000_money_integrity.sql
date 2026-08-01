-- ColocApp — intégrité de l'argent
--
-- Trois garanties que l'application ne pouvait pas tenir seule :
--   1. les soldes sont agrégés en base, donc jamais tronqués par le plafond de
--      lignes de l'API (`listExpenses` rapatriait tout l'historique) ;
--   2. une dépense et sa répartition sont écrites dans une seule transaction, et
--      le schéma refuse désormais toute dépense dont les parts ne totalisent pas
--      le montant ;
--   3. un remboursement rejoué (double tap, retry réseau) ne crée pas de doublon.
--
-- Comme le reste du schéma, ces fonctions sont en `security invoker` et révoquées
-- pour `anon`/`authenticated` : seule la clé service_role, utilisée côté serveur,
-- peut les appeler.

-- ---------------------------------------------------------------------------
-- 1. Invariant : somme des parts = montant de la dépense
-- ---------------------------------------------------------------------------

-- Vérifié en fin de transaction (`deferrable initially deferred`) : la dépense et
-- ses parts s'insèrent en deux ordres, l'invariant n'est vrai qu'au commit.
-- Déplacer une part d'une dépense à une autre touche **deux** dépenses : on
-- vérifie l'ancienne comme la nouvelle, sinon celle qu'on quitte reste
-- déséquilibrée sans que rien ne le signale.
create or replace function public.assert_expense_shares_sum()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_amount bigint;
  v_sum    bigint;
begin
  if tg_table_name = 'expenses' then
    if tg_op <> 'DELETE' then v_ids := array[new.id]; end if;
  else
    if tg_op <> 'INSERT' then v_ids := v_ids || old.expense_id; end if;
    if tg_op <> 'DELETE' then v_ids := v_ids || new.expense_id; end if;
  end if;

  foreach v_id in array v_ids loop
    select amount_cents into v_amount from public.expenses where id = v_id;
    -- Dépense supprimée : les parts partent en cascade, il n'y a plus rien à vérifier.
    continue when v_amount is null;

    select coalesce(sum(amount_cents), 0) into v_sum
    from public.expense_shares
    where expense_id = v_id;

    if v_sum <> v_amount then
      raise exception
        'Répartition incohérente : % centimes répartis pour une dépense de % centimes (dépense %)',
        v_sum, v_amount, v_id;
    end if;
  end loop;

  return null;
end;
$$;

-- `drop … if exists` d'abord : `create constraint trigger` n'accepte ni
-- `if not exists` ni `or replace`, et rejouer la migration échouerait ici.
drop trigger if exists expenses_shares_sum_check on public.expenses;
create constraint trigger expenses_shares_sum_check
  after insert or update of amount_cents on public.expenses
  deferrable initially deferred
  for each row execute function public.assert_expense_shares_sum();

drop trigger if exists expense_shares_sum_check on public.expense_shares;
create constraint trigger expense_shares_sum_check
  after insert or update or delete on public.expense_shares
  deferrable initially deferred
  for each row execute function public.assert_expense_shares_sum();

-- ---------------------------------------------------------------------------
-- 2. Création atomique d'une dépense
-- ---------------------------------------------------------------------------

-- `p_shares` : [{"user_id": "…", "amount_cents": 1234}, …]
-- L'identifiant est fourni par l'application : elle en dérive le décalage
-- d'arrondi (voir `splitEvenly`), et l'appel devient rejouable.
create or replace function public.create_expense_with_shares(
  p_id           uuid,
  p_household_id uuid,
  p_payer_id     uuid,
  p_amount_cents bigint,
  p_description  text,
  p_category     text,
  p_spent_on     date,
  p_created_by   uuid,
  p_shares       jsonb
)
returns public.expenses
language plpgsql
set search_path = public
as $$
declare
  v_expense public.expenses;
  v_sum     bigint;
  v_count   integer;
begin
  select count(*), coalesce(sum((share ->> 'amount_cents')::bigint), 0)
    into v_count, v_sum
  from jsonb_array_elements(p_shares) as share;

  if v_count = 0 then
    raise exception 'Une dépense doit concerner au moins un coloc.';
  end if;
  if v_sum <> p_amount_cents then
    raise exception 'Répartition incohérente : % centimes pour une dépense de % centimes', v_sum, p_amount_cents;
  end if;

  insert into public.expenses
    (id, household_id, payer_id, amount_cents, description, category, spent_on, created_by)
  values
    (p_id, p_household_id, p_payer_id, p_amount_cents, p_description, p_category, p_spent_on, p_created_by)
  returning * into v_expense;

  insert into public.expense_shares (expense_id, user_id, amount_cents)
  select v_expense.id, (share ->> 'user_id')::uuid, (share ->> 'amount_cents')::bigint
  from jsonb_array_elements(p_shares) as share;

  return v_expense;
end;
$$;

-- `expense_shares.user_id` était en `on delete cascade` : supprimer un utilisateur
-- emportait ses parts et laissait les dépenses déséquilibrées. Le trigger
-- ci-dessus le refuserait désormais, mais au COMMIT et avec un message
-- incompréhensible. En `restrict`, l'échec est immédiat et explicite — et c'est
-- déjà ce que fait `expenses.payer_id`.
alter table public.expense_shares
  drop constraint expense_shares_user_id_fkey,
  add constraint expense_shares_user_id_fkey
    foreign key (user_id) references public.users (id) on delete restrict;

-- Les lectures exhaustives (`listExpenses` sans limite) paginent dans l'ordre
-- d'insertion : une dépense ajoutée pendant le parcours s'ajoute à la fin et ne
-- décale donc aucune page déjà lue. `id` départage les `created_at` identiques.
create index if not exists expenses_household_created_at_idx
  on public.expenses (household_id, created_at, id);

-- ---------------------------------------------------------------------------
-- 3. Soldes agrégés en base
-- ---------------------------------------------------------------------------

-- Renvoie une ligne par personne ayant touché à l'argent de la colocation —
-- y compris un ancien coloc qui n'est plus membre. L'application complète avec
-- les membres à zéro (voir `balancesFromTotals`).
create or replace function public.household_balances(p_household_id uuid)
returns table (
  user_id           uuid,
  paid_cents        bigint,
  owed_cents        bigint,
  settled_out_cents bigint,
  settled_in_cents  bigint
)
language sql
stable
set search_path = public
as $$
  with paid as (
    select payer_id as uid, sum(amount_cents) as cents
    from public.expenses
    where household_id = p_household_id
    group by payer_id
  ),
  owed as (
    select s.user_id as uid, sum(s.amount_cents) as cents
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where e.household_id = p_household_id
    group by s.user_id
  ),
  paid_out as (
    select from_user_id as uid, sum(amount_cents) as cents
    from public.settlements
    where household_id = p_household_id
    group by from_user_id
  ),
  paid_in as (
    select to_user_id as uid, sum(amount_cents) as cents
    from public.settlements
    where household_id = p_household_id
    group by to_user_id
  ),
  everyone as (
    select uid from paid
    union select uid from owed
    union select uid from paid_out
    union select uid from paid_in
  )
  select
    everyone.uid,
    coalesce(paid.cents, 0)::bigint,
    coalesce(owed.cents, 0)::bigint,
    coalesce(paid_out.cents, 0)::bigint,
    coalesce(paid_in.cents, 0)::bigint
  from everyone
  left join paid     on paid.uid     = everyone.uid
  left join owed     on owed.uid     = everyone.uid
  left join paid_out on paid_out.uid = everyone.uid
  left join paid_in  on paid_in.uid  = everyone.uid;
$$;

-- ---------------------------------------------------------------------------
-- 4. Remboursements : rejouables et groupés
-- ---------------------------------------------------------------------------

-- Jeton d'intention. `gen_random_uuid()` est volatile, donc chaque ligne déjà en
-- base reçoit un jeton distinct à l'ajout de la colonne : l'index unique ci-dessous
-- s'applique sans conflit sur l'historique.
alter table public.settlements
  add column if not exists client_token uuid not null default gen_random_uuid();

-- Le couple payeur/bénéficiaire fait partie de la clé, et ce n'est pas décoratif :
-- si l'unicité ne portait que sur le jeton, rejouer une intention vers un **autre**
-- coloc réécrirait la ligne du premier — un remboursement réellement versé serait
-- effacé. Ici, un destinataire différent produit une nouvelle ligne ; seul un rejeu
-- à l'identique retombe sur l'existante.
create unique index if not exists settlements_client_token_idx
  on public.settlements (household_id, client_token, from_user_id, to_user_id);

-- `p_settlements` : [{"from_user_id","to_user_id","amount_cents","note","settled_on","client_token"}]
-- `client_token` est facultatif : les appels qui recalculent leur montant côté
-- serveur (« Tout régler ») sont déjà idempotents par construction — après un
-- premier succès il ne reste plus rien à solder — et n'ont pas besoin de jeton.
-- Tout passe ou rien : le lot ne peut plus s'arrêter à mi-parcours.
create or replace function public.record_settlements(
  p_household_id uuid,
  p_created_by   uuid,
  p_settlements  jsonb
)
returns setof public.settlements
language sql
set search_path = public
as $$
  insert into public.settlements
    (household_id, from_user_id, to_user_id, amount_cents, note, settled_on, created_by, client_token)
  select
    p_household_id,
    (s ->> 'from_user_id')::uuid,
    (s ->> 'to_user_id')::uuid,
    (s ->> 'amount_cents')::bigint,
    nullif(btrim(coalesce(s ->> 'note', '')), ''),
    coalesce((s ->> 'settled_on')::date, current_date),
    p_created_by,
    -- Une valeur NULL explicite ne retombe pas sur le `default` de la colonne.
    coalesce((s ->> 'client_token')::uuid, gen_random_uuid())
  from jsonb_array_elements(p_settlements) as s
  -- Rejeu de la même intention : on renvoie la ligne déjà écrite au lieu d'un doublon.
  on conflict (household_id, client_token, from_user_id, to_user_id) do update
    set amount_cents = excluded.amount_cents,
        note         = excluded.note,
        settled_on   = excluded.settled_on
  returning *;
$$;

-- ---------------------------------------------------------------------------
-- Verrouillage : même règle que le schéma initial
-- ---------------------------------------------------------------------------

revoke all on function public.create_expense_with_shares(
  uuid, uuid, uuid, bigint, text, text, date, uuid, jsonb
) from public, anon, authenticated;

revoke all on function public.household_balances(uuid) from public, anon, authenticated;

revoke all on function public.record_settlements(uuid, uuid, jsonb) from public, anon, authenticated;
