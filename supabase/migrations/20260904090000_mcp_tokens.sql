-- ColocApp — jetons MCP personnels
--
-- Chaque coloc dispose d'un lien d'endpoint MCP à coller dans son assistant
-- (Claude, etc.). Le jeton *est* le lien : il voyage dans le chemin de l'URL,
-- puisqu'un connecteur MCP distant ne transmet pas les cookies de session.
--
-- Il est stocké en clair, et c'est délibéré : l'écran de réglages doit pouvoir
-- réafficher le lien à tout moment (le hacher obligerait à ne le montrer qu'une
-- fois). Le contre-poids est la révocation — « Régénérer » invalide l'ancien
-- lien immédiatement. Comme le reste du schéma, la table est en RLS sans policy :
-- seule la clé service_role, côté serveur, y accède.

create table if not exists public.mcp_tokens (
  -- Un seul lien par personne : la clé primaire porte l'unicité.
  user_id      uuid primary key references public.users (id) on delete cascade,
  token        text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.mcp_tokens enable row level security;
alter table public.mcp_tokens force row level security;
revoke all on public.mcp_tokens from anon, authenticated;
