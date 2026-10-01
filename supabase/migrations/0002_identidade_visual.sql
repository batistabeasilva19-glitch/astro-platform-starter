-- ════════════════════════════════════════════════════════════════════
-- Soltria · Módulo IDENTIDADE VISUAL
-- Migration 0002 — ADITIVA: só cria tabelas novas (prefixo identity_).
-- Não altera nenhuma tabela, função ou policy do módulo de conteúdo.
-- Reutiliza: public.clients, public.users, public.set_updated_at(),
--            public.owns_client() e o bucket privado "media".
--
-- Como aplicar: Supabase → SQL Editor → cole tudo → Run.
-- ════════════════════════════════════════════════════════════════════

-- ─── Projeto de identidade visual (1 cliente pode ter vários) ───────
create table public.identity_projects (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  name              text not null,
  description       text not null default '',
  start_date        date,
  internal_notes    text not null default '',
  status            text not null default 'in_creation'
                    check (status in ('in_creation', 'awaiting_approval', 'changes_requested', 'approved', 'finalized')),
  -- Link público PRÓPRIO deste módulo (independente do link de conteúdo).
  review_token      text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  token_active      boolean not null default true,
  token_rotated_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger identity_projects_updated_at before update on public.identity_projects
  for each row execute function public.set_updated_at();
create index identity_projects_client_idx on public.identity_projects (client_id);

-- ─── Etapas (uma linha por etapa; `enabled` liga/desliga no admin) ──
create table public.identity_stages (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.identity_projects (id) on delete cascade,
  stage_key        text not null
                   check (stage_key in ('concept', 'moodboard', 'logo', 'colors', 'typography',
                                        'elements', 'applications', 'final', 'files')),
  enabled          boolean not null default true,
  status           text not null default 'draft'
                   check (status in ('draft', 'awaiting', 'changes_requested', 'approved')),
  current_version  integer not null default 1,
  approved_at      timestamptz,
  approved_by      text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, stage_key)
);
create trigger identity_stages_updated_at before update on public.identity_stages
  for each row execute function public.set_updated_at();

-- ─── Versões da etapa (conteúdo textual em jsonb; nada se perde) ────
create table public.identity_versions (
  id              uuid primary key default gen_random_uuid(),
  stage_id        uuid not null references public.identity_stages (id) on delete cascade,
  version_number  integer not null,
  content         jsonb not null default '{}'::jsonb,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  unique (stage_id, version_number)
);

-- ─── Propostas de logo (Proposta A, B, C…) ──────────────────────────
create table public.identity_logo_proposals (
  id           uuid primary key default gen_random_uuid(),
  stage_id     uuid not null references public.identity_stages (id) on delete cascade,
  version_id   uuid not null references public.identity_versions (id) on delete cascade,
  label        text not null,
  description  text not null default '',
  position     integer not null default 0,
  is_favorite  boolean not null default false,   -- favoritar NÃO é aprovar
  is_chosen    boolean not null default false,   -- "Escolher" (uma por versão)
  chosen_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index identity_logo_proposals_version_idx on public.identity_logo_proposals (version_id, position);

-- ─── Arquivos (imagens/arquivos de cada versão, em ordem) ───────────
create table public.identity_assets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.identity_projects (id) on delete cascade,
  stage_id      uuid not null references public.identity_stages (id) on delete cascade,
  version_id    uuid not null references public.identity_versions (id) on delete cascade,
  proposal_id   uuid references public.identity_logo_proposals (id) on delete cascade,
  slot          text not null default 'image',  -- logo: primary|secondary|symbol|horizontal|vertical|light|dark|mono|avatar
  caption       text not null default '',
  storage_path  text not null,
  file_name     text not null default '',
  mime_type     text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index identity_assets_version_idx on public.identity_assets (version_id, position);
create index identity_assets_proposal_idx on public.identity_assets (proposal_id);

-- ─── Comentários / pedidos de alteração ─────────────────────────────
create table public.identity_comments (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.identity_projects (id) on delete cascade,
  stage_id           uuid not null references public.identity_stages (id) on delete cascade,
  version_id         uuid references public.identity_versions (id) on delete set null,
  author_type        public.author_type not null,
  author_name        text not null,
  message            text not null,
  is_change_request  boolean not null default false,
  created_at         timestamptz not null default now()
);
create index identity_comments_stage_idx on public.identity_comments (stage_id, created_at);

-- ─── Aprovações ─────────────────────────────────────────────────────
create table public.identity_approvals (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.identity_projects (id) on delete cascade,
  stage_id     uuid not null references public.identity_stages (id) on delete cascade,
  version_id   uuid references public.identity_versions (id) on delete set null,
  action       text not null check (action in ('approved', 'changes_requested')),
  client_name  text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index identity_approvals_stage_idx on public.identity_approvals (stage_id, created_at);

-- ─── Histórico ──────────────────────────────────────────────────────
create table public.identity_activity (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.identity_projects (id) on delete cascade,
  stage_id    uuid references public.identity_stages (id) on delete cascade,
  actor_type  text not null check (actor_type in ('admin', 'client', 'system')),
  actor_name  text not null default '',
  action      text not null,
  detail      text not null default '',
  created_at  timestamptz not null default now()
);
create index identity_activity_project_idx on public.identity_activity (project_id, created_at);

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security — mesma lógica do módulo de conteúdo:
-- a administradora (authenticated) só acessa o que é do cliente dela.
-- O portal público NÃO usa RLS/anon: o servidor valida o token e usa a service role.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.owns_identity(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.identity_projects p
    join public.clients c on c.id = p.client_id
    where p.id = pid and c.owner_id = auth.uid()
  );
$$;

alter table public.identity_projects        enable row level security;
alter table public.identity_stages          enable row level security;
alter table public.identity_versions        enable row level security;
alter table public.identity_logo_proposals  enable row level security;
alter table public.identity_assets          enable row level security;
alter table public.identity_comments        enable row level security;
alter table public.identity_approvals       enable row level security;
alter table public.identity_activity        enable row level security;

create policy identity_projects_owner on public.identity_projects
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));

create policy identity_stages_owner on public.identity_stages
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

create policy identity_versions_owner on public.identity_versions
  for all to authenticated
  using (exists (select 1 from public.identity_stages s where s.id = stage_id and public.owns_identity(s.project_id)))
  with check (exists (select 1 from public.identity_stages s where s.id = stage_id and public.owns_identity(s.project_id)));

create policy identity_logo_proposals_owner on public.identity_logo_proposals
  for all to authenticated
  using (exists (select 1 from public.identity_stages s where s.id = stage_id and public.owns_identity(s.project_id)))
  with check (exists (select 1 from public.identity_stages s where s.id = stage_id and public.owns_identity(s.project_id)));

create policy identity_assets_owner on public.identity_assets
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

create policy identity_comments_owner on public.identity_comments
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

create policy identity_approvals_owner on public.identity_approvals
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

create policy identity_activity_owner on public.identity_activity
  for all to authenticated using (public.owns_identity(project_id)) with check (public.owns_identity(project_id));

-- Storage: nenhuma policy nova — os arquivos usam o bucket "media" e o mesmo caminho
-- {owner_id}/{client_id}/identidade/{project_id}/… (a regra da pasta {owner_id} já existe).
