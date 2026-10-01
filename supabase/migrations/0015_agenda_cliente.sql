-- ════════════════════════════════════════════════════════════════════
-- Soltria · AGENDA do cliente — gravações e reuniões de alinhamento (0015)
-- ADITIVA e segura: só cria uma tabela nova. A administradora agenda (RLS por
-- cliente); o cliente vê pelo link dele só o que estiver marcado como visível.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.client_events (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null default 'recording' check (kind in ('recording', 'meeting')),
  title       text not null,
  event_date  date not null,
  start_time  time,
  end_time    time,
  location    text not null default '',   -- local da gravação ou "Google Meet"
  link        text not null default '',   -- link da reunião online (opcional)
  notes       text not null default '',   -- o que levar, figurino, pauta…
  status      text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists client_events_idx on public.client_events (client_id, event_date);

drop trigger if exists client_events_updated_at on public.client_events;
create trigger client_events_updated_at before update on public.client_events for each row execute function public.set_updated_at();

alter table public.client_events enable row level security;
drop policy if exists client_events_owner on public.client_events;
create policy client_events_owner on public.client_events
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));
