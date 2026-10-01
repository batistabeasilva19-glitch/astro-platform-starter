import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  delta,
  fmtDec,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtRatio,
  fmtSigned,
  fmtSignedPct,
  type Delta,
  type FormatStat,
  type OrganicPaidRow,
  type PaidData,
  type PaidTotals,
  type PillarStat,
  type ProfileAgg,
  type Ranking,
} from '@/lib/perf/calc';
import { PLATFORM_LABEL } from '@/lib/perf/types';
import { HBars, CompareBars, BarChart, ChartEmpty, CHART_COLORS } from './charts';

export function DeltaPill({ d, invert }: { d: Delta; invert?: boolean }) {
  if (d.dir == null) return <span className="text-xs text-ink/40">sem período anterior</span>;
  const good = d.dir === 'flat' ? null : (d.dir === 'up') !== !!invert;
  const Icon = d.dir === 'up' ? ArrowUpRight : d.dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', good === null ? 'bg-ink/5 text-ink/60' : good ? 'bg-wine text-white' : 'bg-white text-wine ring-1 ring-wine/40')}>
      <Icon className="size-3.5" aria-hidden />
      {d.pct != null ? fmtSignedPct(d.pct) : fmtSigned(d.abs)}
    </span>
  );
}

export function Kpi({ label, value, sub, d, hint }: { label: string; value: string; sub?: string; d: Delta; hint?: string }) {
  return (
    <div className="rounded-3xl border border-wine/15 bg-white p-4 sm:p-5">
      <p className="label text-wine/70">{label}</p>
      <p className="h-display mt-2 text-3xl text-wine sm:text-4xl">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <DeltaPill d={d} />
        {sub && <span className="text-xs text-ink/55">{sub}</span>}
      </div>
      {hint && <p className="mt-1 text-[0.7rem] text-ink/40">{hint}</p>}
    </div>
  );
}

/** Cartões da visão geral: valor atual, variação absoluta, variação % e comparação com o período anterior. */
export function KpiGrid({ cur, prev, prevLabel }: { cur: ProfileAgg; prev: ProfileAgg; prevLabel: string }) {
  const vs = `vs ${prevLabel}`;
  const dd = (a: number | null, b: number | null) => delta(a, b);
  const cards = [
    { label: 'Seguidores', value: fmtInt(cur.followersEnd), d: { abs: cur.net, pct: cur.growthPct, dir: cur.net == null ? null : cur.net > 0 ? 'up' : cur.net < 0 ? 'down' : 'flat' } as Delta, sub: cur.net != null ? `${fmtSigned(cur.net)} no período` : undefined },
    { label: 'Alcance', value: fmtInt(cur.reach), d: dd(cur.reach, prev.reach), sub: vs },
    { label: 'Impressões', value: fmtInt(cur.impressions), d: dd(cur.impressions, prev.impressions), sub: vs },
    { label: 'Engajamentos', value: fmtInt(cur.interactions), d: dd(cur.interactions, prev.interactions), sub: vs },
    { label: 'Visitas ao perfil', value: fmtInt(cur.visits), d: dd(cur.visits, prev.visits), sub: vs },
    { label: 'Cliques no link', value: fmtInt(cur.linkClicks), d: dd(cur.linkClicks, prev.linkClicks), sub: vs },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((c) => (
        <Kpi key={c.label} {...c} />
      ))}
    </div>
  );
}

export function EngagementRates({ cur }: { cur: ProfileAgg }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-3xl bg-blush p-4">
        <p className="label text-wine/70">Taxa de engajamento por seguidores</p>
        <p className="h-display mt-1 text-3xl text-wine">{fmtPct(cur.erFollowers)}</p>
        <p className="mt-1 text-xs text-ink/55">Fórmula: interações ÷ seguidores × 100</p>
      </div>
      <div className="rounded-3xl bg-blush p-4">
        <p className="label text-wine/70">Taxa de engajamento por alcance</p>
        <p className="h-display mt-1 text-3xl text-wine">{fmtPct(cur.erReach)}</p>
        <p className="mt-1 text-xs text-ink/55">Fórmula: interações ÷ alcance × 100</p>
      </div>
    </div>
  );
}

export function CompareProfile({ cur, prev, curLabel, prevLabel }: { cur: ProfileAgg; prev: ProfileAgg; curLabel: string; prevLabel: string }) {
  return (
    <CompareBars
      curLabel={curLabel}
      prevLabel={prevLabel}
      rows={[
        { label: 'Seguidores', cur: cur.followersEnd, prev: prev.followersEnd, text: fmtInt },
        { label: 'Alcance', cur: cur.reach, prev: prev.reach, text: fmtInt },
        { label: 'Impressões', cur: cur.impressions, prev: prev.impressions, text: fmtInt },
        { label: 'Interações', cur: cur.interactions, prev: prev.interactions, text: fmtInt },
        { label: 'Visitas ao perfil', cur: cur.visits, prev: prev.visits, text: fmtInt },
        { label: 'Cliques no link', cur: cur.linkClicks, prev: prev.linkClicks, text: fmtInt },
      ]}
    />
  );
}

const FORMAT_ICON_TEXT: Record<string, string> = { post: 'Post', carousel: 'Carrossel', reel: 'Reel', story: 'Story', video: 'Vídeo' };

/** Destaques: o melhor conteúdo em cada indicador (não existe um "vencedor" único). */
export function Highlights({ rankings, thumbs, max = 9 }: { rankings: Ranking[]; thumbs: Record<string, string>; max?: number }) {
  if (!rankings.length) return <ChartEmpty>Cadastre o desempenho dos conteúdos para ver os destaques.</ChartEmpty>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rankings.slice(0, max).map((r) => {
        const top = r.entries[0];
        const value = r.def.unit === 'pct' ? fmtPct(top.value) : fmtInt(top.value);
        return (
          <div key={r.def.id} className="overflow-hidden rounded-3xl border border-wine/15 bg-white">
            <div className="aspect-[4/3] bg-blush">
              {thumbs[top.id] ? (
                <img src={thumbs[top.id]} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-wine/50">{FORMAT_ICON_TEXT[top.format] ?? 'Conteúdo'}</div>
              )}
            </div>
            <div className="p-3">
              <p className="label text-wine/70">{r.def.title}</p>
              <p className="mt-0.5 truncate text-sm text-ink/80">{FORMAT_ICON_TEXT[top.format]} · {top.title}</p>
              <p className="h-display text-xl text-wine">{value} <span className="text-xs font-normal text-ink/50">{r.def.unitLabel}</span></p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Rankings completos (top 5 de cada indicador). */
export function RankingLists({ rankings }: { rankings: Ranking[] }) {
  if (!rankings.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rankings.map((r) => (
        <div key={r.def.id} className="rounded-3xl border border-wine/15 bg-white p-4">
          <p className="label mb-2 text-wine">{r.def.title}</p>
          <ol className="space-y-1.5 text-sm">
            {r.entries.map((e, i) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-ink/80"><span className="text-ink/40">{i + 1}.</span> {e.title}</span>
                <span className="shrink-0 text-wine">{r.def.unit === 'pct' ? fmtPct(e.value) : fmtInt(e.value)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function Table({ head, rows, className }: { head: string[]; rows: (string | number)[][]; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-3xl border border-wine/15 bg-white', className)}>
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead>
          <tr className="border-b border-wine/15 text-wine">
            {head.map((h, i) => (
              <th key={h} className={cn('label whitespace-nowrap px-4 py-3 font-normal', i > 0 && 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-wine/10 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={cn('px-4 py-2.5', j > 0 ? 'text-right tabular-nums text-ink/80' : 'text-ink')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormatAnalysis({ formats }: { formats: FormatStat[] }) {
  if (!formats.length) return <ChartEmpty>Cadastre o desempenho de posts, carrosséis, Reels ou Stories para comparar formatos.</ChartEmpty>;
  return (
    <div className="space-y-5">
      <div>
        <p className="label mb-3 text-wine/70">Alcance médio</p>
        <HBars items={formats.map((f) => ({ label: `${f.plural} (${f.count})`, value: f.reach }))} />
      </div>
      <Table
        head={['Formato', 'Alcance médio', 'Engajamento médio', 'Compart.', 'Salvam.', 'Cliques', 'Conversões']}
        rows={formats.map((f) => [f.plural, fmtInt(f.reach), fmtPct(f.er), fmtDec(f.shares), fmtDec(f.saves), fmtDec(f.clicks), fmtInt(f.conversions)])}
      />
      <p className="text-xs text-ink/45">Médias calculadas sobre os conteúdos do período que têm resultado cadastrado. Reels e vídeos usam as visualizações quando não há alcance.</p>
    </div>
  );
}

export function PillarAnalysis({ pillars }: { pillars: PillarStat[] }) {
  if (!pillars.length) return <ChartEmpty>Adicione pilares (tags) aos conteúdos para ver o desempenho por pilar.</ChartEmpty>;
  return (
    <Table head={['Pilar', 'Conteúdos', 'Alcance médio', 'Engajamento', 'Salvam. médios', 'Cliques médios', 'Conversões']} rows={pillars.map((p) => [p.tag, p.count, fmtInt(p.reach), fmtPct(p.er), fmtDec(p.saves), fmtDec(p.clicks), fmtInt(p.conversions)])} />
  );
}

export function PaidKpis({ t }: { t: PaidTotals }) {
  const items: [string, string][] = [
    ['Investimento', fmtMoney(t.investment)],
    ['Impressões', fmtInt(t.impressions)],
    ['Alcance', fmtInt(t.reach)],
    ['Cliques', fmtInt(t.clicks)],
    ['CTR', fmtPct(t.ctr)],
    ['CPC', fmtMoney(t.cpc)],
    ['CPM', fmtMoney(t.cpm)],
    ['Leads', fmtInt(t.leads)],
    ['CPL', fmtMoney(t.cpl)],
    ['Conversões', fmtInt(t.conversions)],
    ['CPA', fmtMoney(t.cpa)],
    ['ROAS', fmtRatio(t.roas)],
  ].filter(([, v]) => v !== '–') as [string, string][];
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(([l, v]) => (
        <div key={l} className="rounded-2xl border border-wine/15 bg-white px-4 py-3">
          <p className="label text-wine/70">{l}</p>
          <p className="h-display text-2xl text-wine">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function PaidAnalysis({ paid }: { paid: PaidData }) {
  const multi = paid.byMonth.length > 1;
  return (
    <div className="space-y-6">
      <PaidKpis t={paid.totals} />
      {paid.campaigns.length > 0 && (
        <Table
          head={['Campanha', 'Plataforma', 'Investimento', 'Cliques', 'Leads', 'Conversões', 'ROAS']}
          rows={paid.campaigns.map((c) => [c.name, PLATFORM_LABEL[c.platform] ?? c.platform, fmtMoney(c.totals.investment), fmtInt(c.totals.clicks), fmtInt(c.totals.leads), fmtInt(c.totals.conversions), fmtRatio(c.totals.roas)])}
        />
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {([['Investimento (R$)', 'investment', (n: number) => fmtMoney(n)], ['Cliques', 'clicks', fmtInt], ['Leads', 'leads', fmtInt], ['Conversões', 'conversions', fmtInt], ['Custo por lead (R$)', 'cpl', (n: number) => fmtMoney(n)], ['ROAS', 'roas', (n: number) => fmtRatio(n)]] as const).map(([label, key, fmt], i) => {
          const pts = multi ? paid.byMonth.map((m) => ({ label: m.label, value: m.totals[key as keyof PaidTotals] as number | null })) : paid.campaigns.map((c) => ({ label: c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name, value: c.totals[key as keyof PaidTotals] as number | null }));
          if (!pts.some((p) => p.value != null && p.value > 0)) return null;
          return (
            <div key={key}>
              <p className="label mb-2 text-wine/70">{label}</p>
              <BarChart points={pts} format={fmt} color={CHART_COLORS[i % 2 === 0 ? 0 : 1]} ariaLabel={label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrganicPaidTable({ rows }: { rows: OrganicPaidRow[] }) {
  if (!rows.length) return <ChartEmpty>Associe campanhas aos conteúdos para comparar orgânico × pago.</ChartEmpty>;
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.contentId} className="rounded-3xl border border-wine/15 bg-white p-4">
          <p className="text-sm text-ink">{r.title} <span className="text-xs text-ink/50">· {r.campaigns.join(', ')}</span></p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="label mb-1 text-wine">Orgânico</p>
              <ul className="space-y-0.5 text-sm text-ink/75">
                <li>Alcance: {fmtInt(r.organic.reach)}</li>
                <li>Engajamento: {fmtPct(r.organic.er)}</li>
                <li>Cliques: {fmtInt(r.organic.clicks)}</li>
              </ul>
            </div>
            <div>
              <p className="label mb-1 text-wine">Pago</p>
              <ul className="space-y-0.5 text-sm text-ink/75">
                <li>Alcance: {fmtInt(r.paid.reach)}</li>
                <li>Impressões: {fmtInt(r.paid.impressions)}</li>
                <li>Cliques: {fmtInt(r.paid.clicks)}</li>
                <li>Conversões: {fmtInt(r.paid.conversions)}</li>
                <li>Investimento: {fmtMoney(r.paid.investment)}</li>
              </ul>
            </div>
            <div>
              <p className="label mb-1 text-wine">Total</p>
              <ul className="space-y-0.5 text-sm text-ink/75">
                <li>Cliques: {fmtInt(r.total.clicks)}</li>
                <li>Conversões: {fmtInt(r.total.conversions)}</li>
              </ul>
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-ink/45">Alcance e impressões não são somados entre orgânico e pago: as mesmas pessoas podem ter sido contadas nos dois. O total mostra apenas cliques e conversões. Se a campanha tem mais de um criativo, os números pagos são da campanha inteira.</p>
    </div>
  );
}
