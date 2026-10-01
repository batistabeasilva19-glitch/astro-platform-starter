-- ════════════════════════════════════════════════════════════════════
-- Soltria · Identidade Visual — links de acesso rápido (0005)
-- ADITIVA e segura: só adiciona uma coluna. Guarda atalhos privados
-- (pasta do Drive, formulário do Google, etc.) de cada projeto.
-- Visível apenas para a administradora — nunca vai para o portal do cliente.
-- ════════════════════════════════════════════════════════════════════
alter table public.identity_projects add column if not exists links jsonb not null default '[]'::jsonb;
