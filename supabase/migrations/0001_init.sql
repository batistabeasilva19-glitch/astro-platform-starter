-- ════════════════════════════════════════════════════════════════════
-- Soltria · Portal de Aprovação de Conteúdo
-- Migration 0001 — schema, RLS e Storage
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cole tudo → Run.
-- (ou: supabase db push, se estiver usando a CLI)
-- ════════════════════════════════════════════════════════════════════

-- ─── Tipos ──────────────────────────────────────────────────────────
create type public.content_format as enum ('post', 'carousel', 'reel', 'story', 'video');

create type public.content_status as enum (
  'draft',              -- Rascunho
  'pending_approval',   -- Aguardando aprovação
  'approved',           -- Aprovado
  'changes_requested',  -- Alteração solicitada
  'revised_pending',    -- Alterado — aguardando nova aprovação
  'scheduled',          -- Programado
  'published'           -- Publicado
);

create type public.media_kind as enum ('image', 'video', 'cover');
create type public.author_type as enum ('admin', 'client');

-- ─── updated_at automático ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── users (perfil da administradora; espelha auth.users) ───────────
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── clients ────────────────────────────────────────────────────────
create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.users (id) on delete cascade,
  company_name      text not null,
  slug              text not null,
  instagram_handle  text not null default '',
  display_name      text,                     -- nome exibido no perfil simulado
  bio               text not null default '',
  contact_name      text not null default '', -- responsável (assina aprovações)
  contact_email     text,
  avatar_path       text,                     -- caminho no bucket "media"
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id, slug)
);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create index clients_owner_idx on public.clients (owner_id);

-- ─── projects (1 por cliente; guarda o link exclusivo) ──────────────
create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null unique references public.clients (id) on delete cascade,
  name              text not null,
  -- Token longo e aleatório (128+ bits). Nunca expõe IDs sequenciais.
  review_token      text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  token_active      boolean not null default true,
  token_rotated_at  timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- ─── content_items ──────────────────────────────────────────────────
create table public.content_items (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  project_id       uuid not null references public.projects (id) on delete cascade,
  title            text not null,
  format           public.content_format not null default 'post',
  scheduled_date   date,
  scheduled_time   time,
  objective        text not null default '',
  internal_notes   text not null default '',
  status           public.content_status not null default 'draft',
  current_version  integer not null default 1,
  approved_at      timestamptz,
  approved_by      text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger content_items_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();
create index content_items_client_idx on public.content_items (client_id, scheduled_date);
create index content_items_status_idx on public.content_items (status);

-- ─── content_versions (legenda/CTA/hashtags são versionados) ────────
create table public.content_versions (
  id              uuid primary key default gen_random_uuid(),
  content_id      uuid not null references public.content_items (id) on delete cascade,
  version_number  integer not null,
  caption         text not null default '',
  cta             text not null default '',
  hashtags        text not null default '',
  duration_seconds integer,                  -- Reel/Vídeo
  note            text not null default '',  -- "o que mudou nesta versão"
  created_at      timestamptz not null default now(),
  unique (content_id, version_number)
);

-- ─── content_media (arquivos de cada versão, em ordem) ──────────────
create table public.content_media (
  id               uuid primary key default gen_random_uuid(),
  content_id       uuid not null references public.content_items (id) on delete cascade,
  version_id       uuid not null references public.content_versions (id) on delete cascade,
  kind             public.media_kind not null,
  storage_path     text not null,
  position         integer not null default 0,   -- ordem dos slides / telas
  mime_type        text,
  created_at       timestamptz not null default now()
);
create index content_media_version_idx on public.content_media (version_id, position);

-- ─── comments (inclui pedidos de alteração e comentários por slide) ─
create table public.comments (
  id                 uuid primary key default gen_random_uuid(),
  content_id         uuid not null references public.content_items (id) on delete cascade,
  version_id         uuid references public.content_versions (id) on delete set null,
  author_type        public.author_type not null,
  author_name        text not null,
  message            text not null,
  slide_index        integer,                    -- 1-based; null = comentário geral
  is_change_request  boolean not null default false,
  created_at         timestamptz not null default now()
);
create index comments_content_idx on public.comments (content_id, created_at);

-- ─── approvals (registro de quem aprovou/pediu alteração, e quando) ─
create table public.approvals (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content_items (id) on delete cascade,
  version_id   uuid references public.content_versions (id) on delete set null,
  action       text not null check (action in ('approved', 'changes_requested')),
  client_name  text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index approvals_content_idx on public.approvals (content_id, created_at);

-- ─── feed_layouts (ordem salva do simulador de feed) ────────────────
create table public.feed_layouts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null unique references public.clients (id) on delete cascade,
  item_order  uuid[] not null default '{}',
  updated_at  timestamptz not null default now()
);
create trigger feed_layouts_updated_at before update on public.feed_layouts
  for each row execute function public.set_updated_at();

-- ─── activity_logs (histórico) ──────────────────────────────────────
create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  content_id  uuid references public.content_items (id) on delete cascade,
  actor_type  text not null check (actor_type in ('admin', 'client', 'system')),
  actor_name  text not null default '',
  action      text not null,      -- created | sent | approved | changes_requested | new_version | comment | status | ...
  detail      text not null default '',
  created_at  timestamptz not null default now()
);
create index activity_logs_content_idx on public.activity_logs (content_id, created_at);

-- ─── notification_outbox (fila para e-mails futuros) ────────────────
create table public.notification_outbox (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients (id) on delete cascade,
  content_id  uuid references public.content_items (id) on delete cascade,
  event       text not null check (event in ('awaiting_approval', 'changes_requested', 'approved')),
  recipient   text,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security
-- Administradora (authenticated) → acessa apenas o que é dela.
-- Portal do cliente NÃO usa RLS/anon: o acesso é feito no servidor,
-- com a service role, depois de validar o token do link.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients c where c.id = cid and c.owner_id = auth.uid());
$$;

create or replace function public.owns_content(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.content_items i
    join public.clients c on c.id = i.client_id
    where i.id = cid and c.owner_id = auth.uid()
  );
$$;

alter table public.users               enable row level security;
alter table public.clients             enable row level security;
alter table public.projects            enable row level security;
alter table public.content_items       enable row level security;
alter table public.content_versions    enable row level security;
alter table public.content_media       enable row level security;
alter table public.comments            enable row level security;
alter table public.approvals           enable row level security;
alter table public.feed_layouts        enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.notification_outbox enable row level security;

create policy users_self on public.users
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy clients_owner on public.clients
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy projects_owner on public.projects
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));

create policy content_items_owner on public.content_items
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));

create policy content_versions_owner on public.content_versions
  for all to authenticated using (public.owns_content(content_id)) with check (public.owns_content(content_id));

create policy content_media_owner on public.content_media
  for all to authenticated using (public.owns_content(content_id)) with check (public.owns_content(content_id));

create policy comments_owner on public.comments
  for all to authenticated using (public.owns_content(content_id)) with check (public.owns_content(content_id));

create policy approvals_owner on public.approvals
  for all to authenticated using (public.owns_content(content_id)) with check (public.owns_content(content_id));

create policy feed_layouts_owner on public.feed_layouts
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));

create policy activity_logs_owner on public.activity_logs
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));

create policy notification_outbox_owner on public.notification_outbox
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));

-- ════════════════════════════════════════════════════════════════════
-- Storage — bucket PRIVADO "media"
-- Estrutura dos caminhos: {owner_id}/{client_id}/{content_id|avatar}/{arquivo}
-- A administradora só lê/escreve dentro da própria pasta ({auth.uid()}/...).
-- O cliente vê as mídias por URLs assinadas geradas no servidor.
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 524288000)   -- 500 MB (o limite efetivo depende do seu plano Supabase)
on conflict (id) do nothing;

create policy media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
