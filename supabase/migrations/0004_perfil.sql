-- ════════════════════════════════════════════════════════════════════
-- Soltria · Perfil da administradora (0004) — ADITIVA e segura
-- Adiciona a foto do perfil. O nome já existe em public.users.name.
-- A foto fica no bucket privado "media": {auth.uid()}/profile/arquivo
-- (a regra de pasta por dona que já existe cobre esse caminho).
-- ════════════════════════════════════════════════════════════════════
alter table public.users add column if not exists avatar_path text;
