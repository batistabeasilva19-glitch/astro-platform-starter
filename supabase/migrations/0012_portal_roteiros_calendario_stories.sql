-- ════════════════════════════════════════════════════════════════════
-- Soltria · Portal do cliente — ROTEIROS, CALENDÁRIO DO MÊS e STORIES (0012)
-- ADITIVA e segura: só cria tabelas novas. Não altera nada existente.
-- A administradora escreve (RLS por cliente); o cliente acessa pelo link dele
-- (servidor valida o token) e só enxerga o que foi marcado como visível/enviado.
-- ════════════════════════════════════════════════════════════════════

-- ─── Roteiros dos vídeos a gravar (em ordem) ────────────────────────
create table if not exists public.client_scripts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  position    integer not null default 0,
  title       text not null,
  script      text not null default '',
  notes       text not null default '',        -- observações para o cliente (ex.: local, figurino)
  shoot_date  date,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists client_scripts_idx on public.client_scripts (client_id, month, position);

-- ─── Calendário do mês para aprovação ───────────────────────────────
create table if not exists public.client_plans (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  note         text not null default '',        -- recado da administradora para o cliente
  status       text not null default 'draft' check (status in ('draft', 'awaiting', 'approved', 'changes_requested')),
  visible      boolean not null default false,  -- só aparece para o cliente depois de enviado
  sent_at      timestamptz,
  approved_at  timestamptz,
  approved_by  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, month)
);
create table if not exists public.client_plan_items (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.client_plans (id) on delete cascade,
  position      integer not null default 0,
  format        text not null default 'post' check (format in ('post', 'carousel', 'reel', 'story', 'video')),
  title         text not null,
  publish_date  date,
  description   text not null default '',       -- tema / ideia / legenda
  content_id    uuid references public.content_items (id) on delete set null,   -- (opcional) mostra a arte já cadastrada
  client_status text not null default 'pending' check (client_status in ('pending', 'approved', 'changes_requested')),
  client_note   text not null default '',
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists client_plan_items_idx on public.client_plan_items (plan_id, position);

-- ─── Stories do dia (ordem 1, 2, 3… e "OK, postei") ─────────────────
create table if not exists public.client_story_items (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  story_date   date not null,
  position     integer not null default 0,
  title        text not null,
  description  text not null default '',
  link         text not null default '',
  content_id   uuid references public.content_items (id) on delete set null,
  visible      boolean not null default true,
  done         boolean not null default false,
  done_at      timestamptz,
  done_by      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_story_items_idx on public.client_story_items (client_id, story_date, position);

do $$
declare t text;
begin
  foreach t in array array['client_scripts', 'client_plans', 'client_story_items']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ─── RLS (administradora) ───────────────────────────────────────────
create or replace function public.owns_plan(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.client_plans p join public.clients c on c.id = p.client_id where p.id = pid and c.owner_id = auth.uid());
$$;

alter table public.client_scripts      enable row level security;
alter table public.client_plans        enable row level security;
alter table public.client_plan_items   enable row level security;
alter table public.client_story_items  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['client_scripts', 'client_plans', 'client_story_items']
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id))', t, t);
  end loop;
end $$;
drop policy if exists client_plan_items_owner on public.client_plan_items;
create policy client_plan_items_owner on public.client_plan_items
  for all to authenticated using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));
