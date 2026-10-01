import { BRIEFING_STATUS_LABEL, STAGE_BY_KEY, STAGE_STATUS_META, IDENTITY_STATUS_META, countableStages, progressOf, type IdentityStatus, type StageKey, type StageStatus } from '@/lib/identity/types';
import { cn } from '@/lib/utils';

export function StageStatusBadge({ status, audience = 'admin', version, className, stageKey }: { status: StageStatus; audience?: 'admin' | 'client'; version?: number; className?: string; stageKey?: StageKey }) {
  const m = STAGE_STATUS_META[status];
  const label = stageKey === 'briefing' ? BRIEFING_STATUS_LABEL[status][audience] : status === 'awaiting' && (version ?? 1) > 1 ? (audience === 'client' ? 'Nova versão para revisar' : 'Alterado — aguardando nova aprovação') : audience === 'client' ? m.client : m.label;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] leading-tight', m.chip, className)}>
      <span className="font-normal">{m.symbol}</span>
      {label}
    </span>
  );
}

export function ProjectStatusBadge({ status, audience = 'admin', className }: { status: IdentityStatus; audience?: 'admin' | 'client'; className?: string }) {
  const m = IDENTITY_STATUS_META[status];
  return <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] leading-tight', m.chip, className)}>{audience === 'client' ? m.client : m.label}</span>;
}

/** ████████░░ 80% — barra de progresso das etapas aprovadas. */
export function ProgressBar({ stages, tone = 'wine', showText = true }: { stages: { stage_key: StageKey; enabled: boolean; status: StageStatus }[]; tone?: 'wine' | 'white'; showText?: boolean }) {
  const { approved, total, pct } = progressOf(stages);
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className={cn('h-2 flex-1 overflow-hidden rounded-full', tone === 'wine' ? 'bg-wine/15' : 'bg-white/25')} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn('h-full rounded-full transition-all duration-700', tone === 'wine' ? 'bg-wine' : 'bg-white')} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('font-display text-xl tabular-nums', tone === 'wine' ? 'text-wine' : 'text-white')}>{pct}%</span>
      </div>
      {showText && (
        <p className={cn('mt-1.5 text-xs', tone === 'wine' ? 'text-ink/60' : 'text-white/80')}>
          {approved} de {total} {total === 1 ? 'etapa aprovada' : 'etapas aprovadas'}
        </p>
      )}
    </div>
  );
}

/** Logo ✓  Cores ✓  Tipografia ●  Aplicações ○ — resumo compacto das etapas. */
export function StageChecklist({ stages, max = 6 }: { stages: { stage_key: StageKey; enabled: boolean; status: StageStatus }[]; max?: number }) {
  const list = countableStages(stages).filter((s) => s.stage_key !== 'final');
  const shown = list.slice(0, max);
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.8rem]">
      {shown.map((s) => (
        <li key={s.stage_key} className="flex items-center gap-1.5 text-ink/75">
          <span className="w-3 text-wine">{STAGE_STATUS_META[s.status].symbol}</span>
          <span className="truncate">{STAGE_BY_KEY[s.stage_key].short}</span>
        </li>
      ))}
      {list.length > max && <li className="text-ink/45">+{list.length - max}</li>}
    </ul>
  );
}
