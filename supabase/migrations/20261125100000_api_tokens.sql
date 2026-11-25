-- ColocApp — jetons d'API personnelle
--
-- Pendant de `mcp_tokens` pour l'API REST en lecture (`/api/v1/*`). Une table à
-- part plutôt qu'un jeton partagé : régénérer l'un ne doit pas casser l'autre —
-- un script qui lit les soldes n'a pas à tomber parce qu'on a révoqué le lien
-- donné à son assistant.
--
-- Le jeton voyage dans l'en-tête `Authorization: Bearer …`, jamais dans l'URL :
-- une URL finit dans les journaux, l'historique et les captures d'écran.
--
-- Stocké en clair pour la même raison que le lien MCP — l'écran de réglages doit
-- pouvoir le réafficher — et contre-balancé par « Régénérer ». RLS sans policy :
-- seule la clé service_role, côté serveur, y accède.

create table if not exists public.api_tokens (
  user_id      uuid primary key references public.users (id) on delete cascade,
  token        text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.api_tokens enable row level security;
alter table public.api_tokens force row level security;
revoke all on public.api_tokens from anon, authenticated;
