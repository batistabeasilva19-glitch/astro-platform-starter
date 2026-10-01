-- ════════════════════════════════════════════════════════════════════
-- Soltria · Redes sociais — DESEMPENHO & RELATÓRIOS (0008)
-- ADITIVA e segura: só cria tabelas novas. Não altera nem apaga nada do módulo
-- de conteúdo, da identidade visual ou da estratégia de rede.
--
-- Reaproveita: clients, content_items (o desempenho aponta para o ID do conteúdo
-- que já existe — nunca cria uma cópia do post).
-- ════════════════════════════════════════════════════════════════════

-- ─── Configuração por mês (usou tráfego pago?) ──────────────────────
create table if not exists public.perf_months (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  uses_paid   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, month)
);

-- ─── Métricas do perfil, por período ────────────────────────────────
create table if not exists public.perf_profile_metrics (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  followers_start  bigint check (followers_start >= 0),
  followers_end    bigint check (followers_end >= 0),
  new_followers    bigint check (new_followers >= 0),
  lost_followers   bigint check (lost_followers >= 0),
  reach            bigint check (reach >= 0),
  impressions      bigint check (impressions >= 0),
  views            bigint check (views >= 0),
  profile_visits   bigint check (profile_visits >= 0),
  link_clicks      bigint check (link_clicks >= 0),
  contact_clicks   bigint check (contact_clicks >= 0),
  messages         bigint check (messages >= 0),
  interactions     bigint check (interactions >= 0),   -- total informado (opcional; senão soma as de baixo)
  likes            bigint check (likes >= 0),
  comments         bigint check (comments >= 0),
  shares           bigint check (shares >= 0),
  saves            bigint check (saves >= 0),
  replies          bigint check (replies >= 0),
  sticker_taps     bigint check (sticker_taps >= 0),
  source           text not null default 'manual'
                   check (source in ('instagram_insights', 'meta_business_suite', 'meta_ads', 'google_analytics', 'manual', 'other')),
  source_note      text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (period_end >= period_start),
  unique (client_id, period_start, period_end)
);
create index if not exists perf_profile_metrics_idx on public.perf_profile_metrics (client_id, period_start);

-- ─── Pilares (tags) e objetivos de cada conteúdo ────────────────────
create table if not exists public.perf_content_meta (
  content_id  uuid primary key references public.content_items (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  tags        text[] not null default '{}',
  objectives  text[] not null default '{}',
  updated_at  timestamptz not null default now()
);
create index if not exists perf_content_meta_client_idx on public.perf_content_meta (client_id);

-- ─── Snapshots de desempenho de cada conteúdo (24h, 7 dias, 30 dias…) ─
-- Nunca se sobrescreve: cada coleta é uma linha nova. "is_final" marca o
-- resultado que vai para o relatório (padrão: o mais recente).
create table if not exists public.perf_content_snapshots (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references public.content_items (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  collected_on  date not null,
  label         text not null default 'custom' check (label in ('24h', '7d', '30d', 'custom')),
  metrics       jsonb not null default '{}'::jsonb,
  source        text not null default 'manual'
                check (source in ('instagram_insights', 'meta_business_suite', 'meta_ads', 'google_analytics', 'manual', 'other')),
  source_note   text not null default '',
  notes         text not null default '',
  is_final      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (content_id, collected_on, label)
);
create index if not exists perf_content_snapshots_idx on public.perf_content_snapshots (client_id, content_id, collected_on);
create unique index if not exists perf_content_snapshots_one_final on public.perf_content_snapshots (content_id) where is_final;

-- ─── Tráfego pago (opcional) ────────────────────────────────────────
create table if not exists public.perf_campaigns (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null,
  platform    text not null default 'meta' check (platform in ('meta', 'google', 'other')),
  objective   text not null default '',
  start_date  date,
  end_date    date,
  budget      numeric check (budget >= 0),
  spent       numeric check (spent >= 0),
  status      text not null default 'active' check (status in ('planned', 'active', 'paused', 'finished')),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists perf_campaigns_client_idx on public.perf_campaigns (client_id);

create table if not exists public.perf_campaign_metrics (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.perf_campaigns (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  metrics      jsonb not null default '{}'::jsonb,
  source       text not null default 'manual'
               check (source in ('instagram_insights', 'meta_business_suite', 'meta_ads', 'google_analytics', 'manual', 'other')),
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, month)
);

-- criativos de anúncio: campanha ↔ conteúdos que já existem no sistema
create table if not exists public.perf_campaign_contents (
  campaign_id  uuid not null references public.perf_campaigns (id) on delete cascade,
  content_id   uuid not null references public.content_items (id) on delete cascade,
  primary key (campaign_id, content_id)
);

-- ─── Relatórios mensais ─────────────────────────────────────────────
create table if not exists public.perf_reports (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  month              date not null check (extract(day from month) = 1),
  status             text not null default 'draft' check (status in ('draft', 'in_review', 'ready', 'final', 'sent')),
  visible_to_client  boolean not null default false,       -- "Disponibilizar para cliente"
  edits              jsonb not null default '{}'::jsonb,   -- textos, análises e insights editáveis
  frozen             jsonb,                                -- foto dos dados quando FINALIZADO (não muda mais)
  finalized_at       timestamptz,
  sent_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (client_id, month)
);

create table if not exists public.perf_report_versions (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.perf_reports (id) on delete cascade,
  version_number  integer not null,
  label           text not null default '',
  status          text not null default 'draft',
  edits           jsonb not null default '{}'::jsonb,
  data            jsonb not null default '{}'::jsonb,
  is_final        boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (report_id, version_number)
);

-- ─── updated_at automático ──────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['perf_months', 'perf_profile_metrics', 'perf_content_meta', 'perf_campaigns', 'perf_campaign_metrics', 'perf_reports']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- RLS — a administradora só acessa o que é dela. O portal do cliente usa o
-- servidor (service role) e só lê relatórios FINALIZADOS e liberados.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.owns_campaign(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perf_campaigns p join public.clients c on c.id = p.client_id where p.id = cid and c.owner_id = auth.uid());
$$;

create or replace function public.owns_report(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perf_reports p join public.clients c on c.id = p.client_id where p.id = rid and c.owner_id = auth.uid());
$$;

alter table public.perf_months             enable row level security;
alter table public.perf_profile_metrics    enable row level security;
alter table public.perf_content_meta       enable row level security;
alter table public.perf_content_snapshots  enable row level security;
alter table public.perf_campaigns          enable row level security;
alter table public.perf_campaign_metrics   enable row level security;
alter table public.perf_campaign_contents  enable row level security;
alter table public.perf_reports            enable row level security;
alter table public.perf_report_versions    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['perf_months', 'perf_profile_metrics', 'perf_content_meta', 'perf_content_snapshots', 'perf_campaigns', 'perf_reports']
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id))', t, t);
  end loop;
end $$;

drop policy if exists perf_campaign_metrics_owner on public.perf_campaign_metrics;
create policy perf_campaign_metrics_owner on public.perf_campaign_metrics
  for all to authenticated using (public.owns_campaign(campaign_id)) with check (public.owns_campaign(campaign_id));

drop policy if exists perf_campaign_contents_owner on public.perf_campaign_contents;
create policy perf_campaign_contents_owner on public.perf_campaign_contents
  for all to authenticated
  using (public.owns_campaign(campaign_id) and public.owns_content(content_id))
  with check (public.owns_campaign(campaign_id) and public.owns_content(content_id));

drop policy if exists perf_report_versions_owner on public.perf_report_versions;
create policy perf_report_versions_owner on public.perf_report_versions
  for all to authenticated using (public.owns_report(report_id)) with check (public.owns_report(report_id));
