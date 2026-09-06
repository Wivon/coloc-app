-- ColocApp — modification d'une dépense
--
-- Jusqu'ici, corriger un montant ou un participant imposait de supprimer la
-- dépense et de la ressaisir. Le faire depuis l'application était impossible
-- proprement : l'invariant « somme des parts = montant » est vérifié au COMMIT,
-- et PostgREST ouvre une transaction par requête. Modifier le montant puis
-- remplacer les parts en deux appels échouait donc systématiquement sur la
-- première étape, la dépense étant momentanément déséquilibrée.
--
-- Cette fonction fait les deux dans la même transaction — comme
-- `create_expense_with_shares` le fait pour la création.

-- `p_shares` : [{"user_id": "…", "amount_cents": 1234}, …]
create or replace function public.update_expense_with_shares(
  p_id           uuid,
  p_household_id uuid,
  p_payer_id     uuid,
  p_amount_cents bigint,
  p_description  text,
  p_category     text,
  p_spent_on     date,
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

  -- `household_id` fait partie du filtre : un identifiant d'une autre colocation
  -- ne doit pas se contenter d'échouer plus loin, il ne doit rien atteindre.
  update public.expenses
     set payer_id     = p_payer_id,
         amount_cents = p_amount_cents,
         description  = p_description,
         category     = p_category,
         spent_on     = p_spent_on
   where id = p_id
     and household_id = p_household_id
  returning * into v_expense;

  if v_expense.id is null then
    raise exception 'Dépense introuvable.';
  end if;

  -- Table remplacée en entier : la liste des participants peut changer, et un
  -- `upsert` laisserait derrière lui les parts des colocs retirés. L'invariant
  -- n'est vérifié qu'au COMMIT, la fenêtre où plus rien n'est réparti est donc
  -- invisible de l'extérieur.
  delete from public.expense_shares where expense_id = v_expense.id;

  insert into public.expense_shares (expense_id, user_id, amount_cents)
  select v_expense.id, (share ->> 'user_id')::uuid, (share ->> 'amount_cents')::bigint
  from jsonb_array_elements(p_shares) as share;

  return v_expense;
end;
$$;

-- Même verrouillage que le reste du schéma : seule la clé service_role, utilisée
-- côté serveur, peut appeler la fonction.
revoke all on function public.update_expense_with_shares(
  uuid, uuid, uuid, bigint, text, text, date, jsonb
) from public, anon, authenticated;
