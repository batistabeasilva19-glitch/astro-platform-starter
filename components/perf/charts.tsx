import { cn } from '@/lib/utils';
import { fmtInt, type SeriesPoint } from '@/lib/perf/calc';

/** Gráficos em SVG (sem biblioteca): leves, responsivos (viewBox) e funcionam no painel, no portal e no preview. */
export const CHART_COLORS = ['#771430', '#c9707f', '#282828', '#e8b4b8'];
const GRID = '#e9d9db';
const MUTED = '#8a7f81';

const niceMax = (max: number) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi` : n >= 1000 ? `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace('.', ',').replace(',0', '')} mil` : fmtInt(n));
const pick = <T,>(arr: T[], max: number) => (arr.length <= max ? arr.map((_, i) => i) : arr.map((_, i) => i).filter((i) => i % Math.ceil(arr.length / max) === 0 || i === arr.length - 1));

export function ChartEmpty({ children = 'Sem dados cadastrados para este período.' }: { children?: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-wine/25 bg-blush-soft px-4 py-8 text-center text-sm text-ink/55">{children}</p>;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/65">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const W = 640;
const H = 240;
const PAD = { l: 52, r: 16, t: 14, b: 34 };

/** Gráfico de linha (ex.: seguidores ao longo do tempo). */
export function LineChart({ points, color = CHART_COLORS[0], format = fmtInt, className, ariaLabel }: { points: SeriesPoint[]; color?: string; format?: (n: number) => string; className?: string; ariaLabel?: string }) {
  const pts = points.filter((p): p is { label: string; value: number } => p.value != null);
  if (!pts.length) return <ChartEmpty />;
  const vals = pts.map((p) => p.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min = min * 0.95;
    max = max * 1.05 || 1;
  }
  const span = max - min;
  const lo = Math.max(0, min - span * 0.15);
  const hi = max + span * 0.15;
  const x = (i: number) => PAD.l + (pts.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (pts.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? 'Gráfico de linha'} className={cn('h-auto w-full', className)}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(Math.round(t))}</text>
        </g>
      ))}
      {pts.length > 1 && <path d={area} fill={color} opacity="0.08" />}
      {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="4" fill="#fff" stroke={color} strokeWidth="2.5">
          <title>{`${p.label}: ${format(p.value)}`}</title>
        </circle>
      ))}
      {pick(pts, 7).map((i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={MUTED}>{pts[i].label}</text>
      ))}
    </svg>
  );
}

/** Barras verticais simples (ex.: alcance por período). */
export function BarChart({ points, color = CHART_COLORS[0], format = fmtInt, className, ariaLabel }: { points: SeriesPoint[]; color?: string; format?: (n: number) => string; className?: string; ariaLabel?: string }) {
  const pts = points.filter((p): p is { label: string; value: number } => p.value != null);
  if (!pts.length) return <ChartEmpty />;
  const max = niceMax(Math.max(...pts.map((p) => p.value)));
  const inner = W - PAD.l - PAD.r;
  const bw = Math.min(56, (inner / pts.length) * 0.6);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? 'Gráfico de barras'} className={cn('h-auto w-full', className)}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(Math.round(t))}</text>
        </g>
      ))}
      {pts.map((p, i) => {
        const cx = PAD.l + ((i + 0.5) / pts.length) * inner;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={y(p.value)} width={bw} height={Math.max(1, H - PAD.b - y(p.value))} rx="6" fill={color}>
              <title>{`${p.label}: ${format(p.value)}`}</title>
            </rect>
            <text x={cx} y={y(p.value) - 6} textAnchor="middle" fontSize="11" fill={color}>{compact(Math.round(p.value))}</text>
          </g>
        );
      })}
      {pick(pts, 8).map((i) => (
        <text key={i} x={PAD.l + ((i + 0.5) / pts.length) * inner} y={H - 10} textAnchor="middle" fontSize="11" fill={MUTED}>{pts[i].label}</text>
      ))}
    </svg>
  );
}

/** Barras empilhadas por período (curtidas · comentários · compartilhamentos · salvamentos). */
export function StackedBars({ items, keys, className }: { items: { label: string; [k: string]: number | string }[]; keys: { key: string; label: string }[]; className?: string }) {
  if (!items.length) return <ChartEmpty />;
  const totals = items.map((it) => keys.reduce((a, k) => a + (Number(it[k.key]) || 0), 0));
  const max = niceMax(Math.max(...totals));
  const inner = W - PAD.l - PAD.r;
  const bw = Math.min(64, (inner / items.length) * 0.6);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Interações por tipo" className="h-auto w-full">
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(Math.round(t))}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = PAD.l + ((i + 0.5) / items.length) * inner;
          let acc = 0;
          return (
            <g key={i}>
              {keys.map((k, ki) => {
                const v = Number(it[k.key]) || 0;
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return v > 0 ? (
                  <rect key={k.key} x={cx - bw / 2} y={top} width={bw} height={Math.max(1, h)} fill={CHART_COLORS[ki % 4]}>
                    <title>{`${it.label} · ${k.label}: ${fmtInt(v)}`}</title>
                  </rect>
                ) : null;
              })}
            </g>
          );
        })}
        {pick(items, 8).map((i) => (
          <text key={i} x={PAD.l + ((i + 0.5) / items.length) * inner} y={H - 10} textAnchor="middle" fontSize="11" fill={MUTED}>{items[i].label}</text>
        ))}
      </svg>
      <Legend items={keys.map((k, i) => ({ label: k.label, color: CHART_COLORS[i % 4] }))} />
    </div>
  );
}

/** Barras horizontais com rótulo e valor (comparação por formato / pilar / campanha). */
export function HBars({ items, color = CHART_COLORS[0], className }: { items: { label: string; value: number | null; text?: string }[]; color?: string; className?: string }) {
  const list = items.filter((i) => i.value != null) as { label: string; value: number; text?: string }[];
  if (!list.length) return <ChartEmpty />;
  const max = Math.max(...list.map((i) => i.value)) || 1;
  return (
    <ul className={cn('space-y-3', className)}>
      {list.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink/80">{i.label}</span>
            <span className="shrink-0 font-normal text-wine">{i.text ?? fmtInt(i.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-blush"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.value / max) * 100)}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Dois períodos lado a lado (atual × anterior). */
export function CompareBars({ rows, curLabel, prevLabel, className }: { rows: { label: string; cur: number | null; prev: number | null; text: (n: number) => string }[]; curLabel: string; prevLabel: string; className?: string }) {
  const list = rows.filter((r) => r.cur != null || r.prev != null);
  if (!list.length) return <ChartEmpty />;
  return (
    <div className={className}>
      <ul className="space-y-4">
        {list.map((r) => {
          const max = Math.max(r.cur ?? 0, r.prev ?? 0) || 1;
          return (
            <li key={r.label}>
              <p className="mb-1 text-sm text-ink/80">{r.label}</p>
              {([['cur', r.cur, CHART_COLORS[0]], ['prev', r.prev, CHART_COLORS[3]]] as const).map(([k, v, c]) => (
                <div key={k} className="mb-1 flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-blush">{v != null && <div className="h-full rounded-full" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: c }} />}</div>
                  <span className="w-24 shrink-0 text-right text-xs text-ink/70">{v != null ? r.text(v) : '–'}</span>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      <Legend items={[{ label: curLabel, color: CHART_COLORS[0] }, { label: prevLabel, color: CHART_COLORS[3] }]} />
    </div>
  );
}

/** Funil de desempenho: alcance → visitas → cliques → leads → conversões. */
export function FunnelChart({ steps, className }: { steps: { label: string; value: number }[]; className?: string }) {
  if (steps.length < 2) return <ChartEmpty>Cadastre mais dados (visitas, cliques, leads…) para montar o funil.</ChartEmpty>;
  const max = steps[0].value;
  return (
    <ol className={cn('space-y-1', className)}>
      {steps.map((s, i) => {
        const prev = steps[i - 1];
        const rate = prev && prev.value > 0 ? (s.value / prev.value) * 100 : null;
        return (
          <li key={s.label}>
            {i > 0 && <p className="py-0.5 text-center text-xs text-ink/45">↓ {rate != null ? `${rate.toFixed(rate < 10 ? 1 : 0).replace('.', ',')}% da etapa anterior` : ''}</p>}
            <div className="mx-auto flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-white" style={{ width: `${Math.max(64, (s.value / max) * 100)}%`, background: CHART_COLORS[0], opacity: 1 - i * 0.12 }}>
              <span className="text-sm">{s.label}</span>
              <span className="text-sm font-normal">{fmtInt(s.value)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
