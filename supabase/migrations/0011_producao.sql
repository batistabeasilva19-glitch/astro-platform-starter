-- ════════════════════════════════════════════════════════════════════
-- Soltria · PRODUÇÃO (Kanban interno) — 0011
-- ADITIVA e segura: só cria tabelas novas (prefixo prod_). Não altera nem apaga
-- clientes, conteúdos, identidade, desempenho ou relatórios — a tarefa apenas
-- REFERENCIA o que já existe (client_id, content_id, identity_project_id, report_id,
-- campaign_id). Área INTERNA: o portal do cliente nunca lê estas tabelas.
-- ════════════════════════════════════════════════════════════════════

-- ─── Equipe (hoje só a administradora; estruturado para vários membros) ─
create table if not exists public.prod_members (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.users (id) on delete cascade,
  user_id     uuid references public.users (id) on delete set null,
  name        text not null,
  role        text not null default '',          -- Designer, Editor, Social Media…
  color       text not null default '#771430',
  created_at  timestamptz not null default now()
);
create index if not exists prod_members_owner_idx on public.prod_members (owner_id);

-- ─── Tags personalizadas (com cor) ──────────────────────────────────
create table if not exists public.prod_tags (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#771430',
  created_at  timestamptz not null default now()
);
create unique index if not exists prod_tags_owner_name_idx on public.prod_tags (owner_id, lower(name));

-- ─── Quadros e colunas ──────────────────────────────────────────────
create table if not exists public.prod_boards (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.users (id) on delete cascade,
  name         text not null,
  description  text not null default '',
  client_id    uuid references public.clients (id) on delete set null,   -- quadro dedicado a um cliente (opcional)
  favorite     boolean not null default false,
  archived     boolean not null default false,
  -- sync_status, auto_create, auto_create_column_id, hide_done, require_checklist_for_done
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists prod_boards_owner_idx on public.prod_boards (owner_id, archived);

create table if not exists public.prod_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.prod_boards (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  -- papel da coluna: alimenta sincronização de status, dashboard e métricas
  kind        text not null default 'custom'
              check (kind in ('idea', 'todo', 'production', 'review', 'awaiting_client', 'changes', 'approved', 'scheduled', 'published', 'done', 'custom')),
  created_at  timestamptz not null default now()
);
create index if not exists prod_columns_board_idx on public.prod_columns (board_id, position);

-- ─── Tarefas (cards) ────────────────────────────────────────────────
create table if not exists public.prod_tasks (
  id                   uuid primary key default gen_random_uuid(),
  board_id             uuid not null references public.prod_boards (id) on delete cascade,
  column_id            uuid not null references public.prod_columns (id) on delete cascade,
  position             double precision not null default 0,
  title                text not null,
  description          text not null default '',
  client_id            uuid references public.clients (id) on delete set null,
  project_name         text not null default '',
  -- relações flexíveis: referenciam o que já existe, nunca duplicam
  content_id           uuid references public.content_items (id) on delete set null,
  identity_project_id  uuid references public.identity_projects (id) on delete set null,
  report_id            uuid references public.perf_reports (id) on delete set null,
  campaign_id          uuid references public.perf_campaigns (id) on delete set null,
  start_date           date,
  due_date             date,
  due_time             time,
  priority             text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  category             text not null default 'other'
                       check (category in ('post', 'carousel', 'reel', 'story', 'video', 'identity', 'report', 'meeting', 'client', 'admin', 'change', 'other')),
  internal_notes       text not null default '',
  archived             boolean not null default false,
  completed_at         timestamptz,
  source               text not null default 'manual' check (source in ('manual', 'auto', 'recurring', 'template')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists prod_tasks_board_idx   on public.prod_tasks (board_id, column_id, position);
create index if not exists prod_tasks_client_idx  on public.prod_tasks (client_id);
create index if not exists prod_tasks_content_idx on public.prod_tasks (content_id);
create index if not exists prod_tasks_due_idx     on public.prod_tasks (due_date) where archived = false;

create table if not exists public.prod_task_assignees (
  task_id    uuid not null references public.prod_tasks (id) on delete cascade,
  member_id  uuid not null references public.prod_members (id) on delete cascade,
  primary key (task_id, member_id)
);
create table if not exists public.prod_task_tags (
  task_id  uuid not null references public.prod_tasks (id) on delete cascade,
  tag_id   uuid not null references public.prod_tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- ─── Checklists (várias por tarefa) e subtarefas ────────────────────
create table if not exists public.prod_checklists (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.prod_tasks (id) on delete cascade,
  title      text not null default 'Checklist',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.prod_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references public.prod_checklists (id) on delete cascade,
  text          text not null,
  done          boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists prod_checklist_items_idx on public.prod_checklist_items (checklist_id, position);

create table if not exists public.prod_subtasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.prod_tasks (id) on delete cascade,
  title        text not null,
  status       text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee_id  uuid references public.prod_members (id) on delete set null,
  due_date     date,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ─── Comentários internos, anexos/links e histórico ─────────────────
create table if not exists public.prod_comments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.prod_tasks (id) on delete cascade,
  member_id    uuid references public.prod_members (id) on delete set null,
  author_name  text not null default '',
  body         text not null,
  created_at   timestamptz not null default now()
);
create table if not exists public.prod_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.prod_tasks (id) on delete cascade,
  kind          text not null check (kind in ('file', 'link')),
  name          text not null default '',
  url           text not null default '',           -- links
  link_type     text not null default 'other' check (link_type in ('drive', 'canva', 'figma', 'instagram', 'site', 'other')),
  storage_path  text,                               -- arquivos (bucket privado "media")
  mime_type     text not null default '',
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);
create table if not exists public.prod_activity (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.prod_boards (id) on delete cascade,
  task_id      uuid references public.prod_tasks (id) on delete cascade,
  actor_name   text not null default '',
  action       text not null,
  detail       text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists prod_activity_board_idx on public.prod_activity (board_id, created_at desc);
create index if not exists prod_activity_task_idx  on public.prod_activity (task_id, created_at);

-- ─── Tarefas recorrentes e filtros salvos ───────────────────────────
create table if not exists public.prod_recurrences (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.prod_boards (id) on delete cascade,
  column_id    uuid not null references public.prod_columns (id) on delete cascade,
  title        text not null,
  description  text not null default '',
  client_id    uuid references public.clients (id) on delete set null,
  category     text not null default 'other',
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  cadence      text not null check (cadence in ('daily', 'weekly', 'monthly', 'custom')),
  weekday      integer check (weekday between 0 and 6),          -- 0 = domingo
  month_day    integer check (month_day between 1 and 31),
  every_days   integer check (every_days between 1 and 365),
  due_offset   integer not null default 0,                       -- prazo = data de criação + N dias
  next_run     date not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create table if not exists public.prod_saved_filters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.users (id) on delete cascade,
  board_id    uuid references public.prod_boards (id) on delete cascade,
  name        text not null,
  filter      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ─── updated_at ─────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['prod_boards', 'prod_tasks']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- RLS — somente a dona do quadro acessa (sem nenhuma policy para anon/cliente)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.owns_board(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.prod_boards b where b.id = bid and b.owner_id = auth.uid());
$$;
create or replace function public.owns_task(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.prod_tasks t join public.prod_boards b on b.id = t.board_id where t.id = tid and b.owner_id = auth.uid());
$$;
create or replace function public.owns_checklist(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.prod_checklists c where c.id = cid and public.owns_task(c.task_id));
$$;

alter table public.prod_members          enable row level security;
alter table public.prod_tags             enable row level security;
alter table public.prod_boards           enable row level security;
alter table public.prod_columns          enable row level security;
alter table public.prod_tasks            enable row level security;
alter table public.prod_task_assignees   enable row level security;
alter table public.prod_task_tags        enable row level security;
alter table public.prod_checklists       enable row level security;
alter table public.prod_checklist_items  enable row level security;
alter table public.prod_subtasks         enable row level security;
alter table public.prod_comments         enable row level security;
alter table public.prod_attachments      enable row level security;
alter table public.prod_activity         enable row level security;
alter table public.prod_recurrences      enable row level security;
alter table public.prod_saved_filters    enable row level security;

do $$
declare t text;
begin
  -- tabelas com owner_id
  foreach t in array array['prod_members', 'prod_tags', 'prod_boards', 'prod_saved_filters']
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
  -- tabelas ligadas ao quadro
  foreach t in array array['prod_columns', 'prod_tasks', 'prod_activity', 'prod_recurrences']
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (public.owns_board(board_id)) with check (public.owns_board(board_id))', t, t);
  end loop;
  -- tabelas ligadas à tarefa
  foreach t in array array['prod_task_assignees', 'prod_task_tags', 'prod_checklists', 'prod_subtasks', 'prod_comments', 'prod_attachments']
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (public.owns_task(task_id)) with check (public.owns_task(task_id))', t, t);
  end loop;
end $$;

drop policy if exists prod_checklist_items_owner on public.prod_checklist_items;
create policy prod_checklist_items_owner on public.prod_checklist_items
  for all to authenticated using (public.owns_checklist(checklist_id)) with check (public.owns_checklist(checklist_id));
