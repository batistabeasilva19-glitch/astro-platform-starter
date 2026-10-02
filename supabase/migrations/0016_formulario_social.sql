-- ════════════════════════════════════════════════════════════════════
-- Soltria · FORMULÁRIO DE PERFIL (Social Mídia) (0016)
-- ADITIVA e segura: só cria uma tabela nova. A administradora envia o formulário
-- ao cliente; ele responde pelo link dele (servidor valida o token) e depois de
-- enviado fica TRAVADO até a administradora liberar a edição.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.client_social_forms (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null unique references public.clients (id) on delete cascade,
  status        text not null default 'open' check (status in ('open', 'submitted')),
  answers       jsonb not null default '{}'::jsonb,
  sent_at       timestamptz not null default now(),
  submitted_at  timestamptz,
  submitted_by  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists client_social_forms_updated_at on public.client_social_forms;
create trigger client_social_forms_updated_at before update on public.client_social_forms for each row execute function public.set_updated_at();

alter table public.client_social_forms enable row level security;
drop policy if exists client_social_forms_owner on public.client_social_forms;
create policy client_social_forms_owner on public.client_social_forms
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));
