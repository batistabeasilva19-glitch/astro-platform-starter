-- ════════════════════════════════════════════════════════════════════
-- Soltria · Redes sociais — ESTRATÉGIA DE REDE (0006)
-- ADITIVA e segura: só cria uma tabela nova. Guarda os PDFs de estratégia
-- de cada cliente, organizados por mês. Os arquivos ficam no bucket
-- privado "media" ({owner}/{cliente}/strategy/AAAA-MM/arquivo.pdf).
-- O cliente acessa pelo link dele (servidor valida o token e libera o PDF).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_documents (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  month         date not null check (extract(day from month) = 1),   -- sempre o dia 1 do mês
  title         text not null,
  description   text not null default '',
  storage_path  text not null,
  file_name     text not null default '',
  size_bytes    bigint,
  visible       boolean not null default true,                       -- "Visível para o cliente"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists strategy_documents_client_month_idx on public.strategy_documents (client_id, month desc);

drop trigger if exists strategy_documents_updated_at on public.strategy_documents;
create trigger strategy_documents_updated_at before update on public.strategy_documents
  for each row execute function public.set_updated_at();

alter table public.strategy_documents enable row level security;
drop policy if exists strategy_documents_owner on public.strategy_documents;
create policy strategy_documents_owner on public.strategy_documents
  for all to authenticated using (public.owns_client(client_id)) with check (public.owns_client(client_id));
