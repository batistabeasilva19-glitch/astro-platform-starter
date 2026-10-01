-- ════════════════════════════════════════════════════════════════════
-- Soltria · Identidade Visual — FORMULÁRIO DA MARCA (0007)
-- ADITIVA e segura: libera uma nova etapa ("briefing") e não apaga nada.
-- Projetos já existentes recebem a etapa DESATIVADA (você ativa se quiser).
-- ════════════════════════════════════════════════════════════════════

-- 1) a etapa passa a ser aceita
alter table public.identity_stages drop constraint if exists identity_stages_stage_key_check;
alter table public.identity_stages add constraint identity_stages_stage_key_check
  check (stage_key in ('briefing', 'concept', 'moodboard', 'logo', 'colors', 'typography',
                       'elements', 'applications', 'final', 'files'));

-- 2) projetos já existentes: cria a etapa (desativada) e a versão 1
insert into public.identity_stages (project_id, stage_key, enabled, status)
select p.id, 'briefing', false, 'draft'
from public.identity_projects p
where not exists (select 1 from public.identity_stages s where s.project_id = p.id and s.stage_key = 'briefing');

insert into public.identity_versions (stage_id, version_number, content)
select s.id, 1, '{}'::jsonb
from public.identity_stages s
where s.stage_key = 'briefing'
  and not exists (select 1 from public.identity_versions v where v.stage_id = s.id);
