-- ════════════════════════════════════════════════════════════════════
-- Soltria · Reações com emoji e respostas a um comentário específico (0018)
-- ADITIVA e segura: só acrescenta duas colunas em `comments`.
--   reactions : lista de {emoji, by} ("admin" ou "client"), para mostrar "eu vi" ♡
--   reply_to  : comentário ao qual esta mensagem responde
-- ════════════════════════════════════════════════════════════════════
alter table public.comments add column if not exists reactions jsonb not null default '[]'::jsonb;
alter table public.comments add column if not exists reply_to uuid references public.comments (id) on delete set null;
