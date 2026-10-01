-- ════════════════════════════════════════════════════════════════════
-- Soltria · Calendário do mês — link da arte em cada item (0013)
-- ADITIVA e segura: só acrescenta uma coluna. O link (Drive, Canva, Figma…)
-- aparece para o cliente como "Abrir arte" ao aprovar o item.
-- ════════════════════════════════════════════════════════════════════
alter table public.client_plan_items add column if not exists link text not null default '';
