-- ════════════════════════════════════════════════════════════════════
-- Soltria · LOGIN DO CLIENTE no portal (0014)
-- ADITIVA: só adiciona uma coluna e uma tabela nova. O link do cliente continua
-- funcionando como hoje, até você ativar "Exigir login" para aquele cliente.
-- ════════════════════════════════════════════════════════════════════
alter table public.clients add column if not exists portal_login_required boolean not null default false;

create table if not exists public.client_portal_users (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  email            text not null,
  password_hash    text not null,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now()
);
create unique index if not exists client_portal_users_email on public.client_portal_users (client_id, lower(email));

alter table public.client_portal_users enable row level security;
drop policy if exists client_portal_users_owner on public.client_portal_users;
create policy client_portal_users_owner on public.client_portal_users
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));
