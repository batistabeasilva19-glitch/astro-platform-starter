-- ════════════════════════════════════════════════════════════════════
-- Soltria · Redes sociais — PRINT DO PERFIL "ANTES" (0009)
-- ADITIVA e segura: só cria uma tabela nova. Guarda prints do perfil do cliente
-- (o "antes" do trabalho). Só a administradora acessa: o portal do cliente
-- nunca lê esta tabela. Arquivos no bucket privado "media"
-- ({owner}/{cliente}/profile-before/arquivo).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.client_profile_shots (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  kind          text not null default 'before' check (kind in ('before', 'after')),
  storage_path  text not null,
  caption       text not null default '',
  taken_on      date,
  created_at    timestamptz not null default now()
);
create index if not exists client_profile_shots_idx on public.client_profile_shots (client_id, kind, created_at);

alter table public.client_profile_shots enable row level security;
drop policy if exists client_profile_shots_owner on public.client_profile_shots;
create policy client_profile_shots_owner on public.client_profile_shots
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));
