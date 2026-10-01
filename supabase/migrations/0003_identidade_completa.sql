-- ════════════════════════════════════════════════════════════════════
-- Soltria · Módulo IDENTIDADE VISUAL — complemento (0003)
-- ADITIVA e segura: só cria tabelas/colunas novas. Não apaga nada e não
-- toca em nenhuma tabela do módulo de conteúdo. Rode DEPOIS da 0002.
--
-- Adiciona: versões por proposta de logo, favoritos, seleções do cliente,
-- comentários marcados na imagem, downloads e snapshot das aprovações.
-- ════════════════════════════════════════════════════════════════════

-- ─── Versões de cada proposta de logo (V1, V2, V3… nunca se perdem) ─
create table if not exists public.identity_logo_versions (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.identity_logo_proposals (id) on delete cascade,
  version_number  integer not null,
  changes         text not null default '',   -- "ALTERAÇÕES: …" (visível ao cliente)
  internal_notes  text not null default '',   -- só administradora
  created_at      timestamptz not null default now(),
  unique (proposal_id, version_number)
);
create index if not exists identity_logo_versions_proposal_idx on public.identity_logo_versions (proposal_id, version_number);

-- Propostas passam a existir independentemente da versão da etapa.
alter table public.identity_logo_proposals alter column version_id drop not null;

-- ─── Arquivos: metadados extras, liberação para download e versão de logo
alter table public.identity_assets
  add column if not exists name            text not null default '',
  add column if not exists description     text not null default '',
  add column if not exists category        text not null default '',
  add column if not exists released        boolean not null default false,   -- "Disponibilizar para cliente"
  add column if not exists logo_version_id uuid references public.identity_logo_versions (id) on delete cascade;
create index if not exists identity_assets_logo_version_idx on public.identity_assets (logo_version_id);

-- ─── Aprovações guardam o que foi aprovado (logo/versão/paleta/cores/fontes) ─
alter table public.identity_approvals add column if not exists snapshot jsonb;

-- ─── Favoritos (favoritar NÃO é aprovar) ────────────────────────────
create table if not exists public.identity_favorites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.identity_projects (id) on delete cascade,
  stage_id    uuid references public.identity_stages (id) on delete cascade,
  kind        text not null check (kind in ('logo', 'palette', 'color', 'font', 'application')),
  ref_id      text not null,
  label       text not null default '',
  created_at  timestamptz not null default now(),
  unique (project_id, kind, ref_id)
);
create index if not exists identity_favorites_project_idx on public.identity_favorites (project_id);

-- ─── Seleções do cliente ("Monte sua paleta" → "Enviar minha seleção") ─
create table if not exists public.identity_selections (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.identity_projects (id) on delete cascade,
  stage_id     uuid references public.identity_stages (id) on delete cascade,
  kind         text not null check (kind in ('colors')),
  payload      jsonb not null default '{}'::jsonb,
  client_name  text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists identity_selections_project_idx on public.identity_selections (project_id, kind, created_at);

-- ─── Comentários na imagem (marcador numerado em uma coordenada) ────
create table if not exists public.identity_annotations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.identity_projects (id) on delete cascade,
  stage_id     uuid not null references public.identity_stages (id) on delete cascade,
  asset_id     uuid not null references public.identity_assets (id) on delete cascade,
  x            numeric check (x between 0 and 100),   -- % da largura (null = comentário geral da imagem)
  y            numeric check (y between 0 and 100),   -- % da altura
  number       integer,
  message      text not null,
  author_type  public.author_type not null,
  author_name  text not null,
  created_at   timestamptz not null default now()
);
create index if not exists identity_annotations_asset_idx on public.identity_annotations (asset_id, created_at);

-- ─── Downloads (histórico de quem baixou o quê) ─────────────────────
create table if not exists public.identity_downloads (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.identity_projects (id) on delete cascade,
  asset_id     uuid references public.identity_assets (id) on delete set null,
  file_name    text not null default '',
  client_name  text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists identity_downloads_project_idx on public.identity_downloads (project_id, created_at);

-- ════════════════════════════════════════════════════════════════════
-- RLS (mesma lógica da 0002; o portal público usa service role no servidor)
-- ════════════════════════════════════════════════════════════════════
alter table public.identity_logo_versions enable row level security;
alter table public.identity_favorites     enable row level security;
alter table public.identity_selections    enable row level security;
alter table public.identity_annotations   enable row level security;
alter table public.identity_downloads     enable row level security;

drop policy if exists identity_logo_versions_owner on public.identity_logo_versions;
create policy identity_logo_versions_owner on public.identity_logo_versions
  for all to authenticated
  using (exists (select 1 from public.identity_logo_proposals p join public.identity_stages s on s.id = p.stage_id
                 where p.id = proposal_id and public.owns_identity(s.project_id)))
  with check (exists (select 1 from public.identity_logo_proposals p join public.identity_stages s on s.id = p.stage_id
                      where p.id = proposal_id and public.owns_identity(s.project_id)));

drop policy if exists identity_favorites_owner on public.identity_favorites;
create policy identity_favorites_owner on public.identity_favorites
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

drop policy if exists identity_selections_owner on public.identity_selections;
create policy identity_selections_owner on public.identity_selections
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

drop policy if exists identity_annotations_owner on public.identity_annotations;
create policy identity_annotations_owner on public.identity_annotations
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

drop policy if exists identity_downloads_owner on public.identity_downloads;
create policy identity_downloads_owner on public.identity_downloads
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

-- ─── Migração de dados da 0002 (se já havia propostas): cria a V1 de cada uma
insert into public.identity_logo_versions (proposal_id, version_number)
select p.id, 1 from public.identity_logo_proposals p
where not exists (select 1 from public.identity_logo_versions v where v.proposal_id = p.id);

update public.identity_assets a
set logo_version_id = v.id
from public.identity_logo_versions v
where a.proposal_id = v.proposal_id and v.version_number = 1 and a.logo_version_id is null and a.proposal_id is not null;
