-- ════════════════════════════════════════════════════════════════════
-- Soltria · Desempenho — "ANTES" de cada métrica do perfil (0010)
-- ADITIVA e segura: só acrescenta colunas novas em perf_profile_metrics.
-- Cada período pode guardar os números de "antes" (base de comparação) e o
-- período a que eles se referem. Nada existente é alterado ou apagado.
-- ════════════════════════════════════════════════════════════════════
alter table public.perf_profile_metrics
  add column if not exists before        jsonb not null default '{}'::jsonb,
  add column if not exists before_start  date,
  add column if not exists before_end    date;

do $$ begin
  alter table public.perf_profile_metrics add constraint perf_profile_before_dates_check
    check (before_start is null or before_end is null or before_end >= before_start);
exception when duplicate_object then null; end $$;
