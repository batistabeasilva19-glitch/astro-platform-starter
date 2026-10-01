import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { loadPerfRaw } from '@/lib/data/perf';
import { signPaths } from '@/lib/storage';
import {
  PERIOD_OPTIONS,
  aggregateProfile,
  aggregatePrev,
  autoInsights,
  contentResults,
  delta,
  fmtDec,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtSigned,
  fmtSignedPct,
  formatStats,
  funnel,
  monthLabel,
  monthRange,
  monthlyBreakdown,
  objectiveStats,
  organicVsPaid,
  paidData,
  parsePeriod,
  pillarStats,
  profileSeries,
  rankings,
  resolveRange,
  todayBR,
  type Num,
} from '@/lib/perf/calc';
import { FORMAT_GROUPS } from '@/lib/perf/types';
import { Avatar } from '@/components/ui/Misc';
import { SocialNav, MigrationNotice } from '@/components/perf/SocialNav';
import { BarChart, ChartEmpty, FunnelChart, LineChart, StackedBars } from '@/components/perf/charts';
import { CompareProfile, DeltaPill, EngagementRates, FormatAnalysis, Highlights, KpiGrid, OrganicPaidTable, PaidAnalysis, PillarAnalysis, RankingLists, Table } from '@/components/perf/blocks';
import { ProfileMetricsManager } from '@/components/perf/ProfileMetricsManager';
import { PaidManager } from '@/components/perf/PaidManager';
import { cn, fmtDate } from '@/lib/utils';
import type { ContentLite } from '@/lib/perf/types';

export const metadata = { title: 'Desempenho' };

type SP = { aba?: string; p?: string; from?: string; to?: string; a?: string; b?: string };
const TABS = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'perfil', label: 'Dados do perfil' },
  { id: 'conteudos', label: 'Conteúdos' },
  { id: 'trafego', label: 'Tráfego pago' },
  { id: 'comparar', label: 'Comparar períodos' },
] as const;

const Block = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card p-5 sm:p-6">
    <h2 className="h-display text-2xl text-wine sm:text-3xl">{title}</h2>
    {hint && <p className="mt-1 text-sm text-ink/55">{hint}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

export default async function PerformancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const supabase = await createClient();
  const { raw, missing } = await loadPerfRaw(supabase, id);
  const aba = TABS.some((t) => t.id === sp.aba) ? (sp.aba as (typeof TABS)[number]['id']) : 'visao';
  const period = parsePeriod(sp.p);
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(sp.p ? { p: sp.p } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...extra });
    return `?${q.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-6 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">Redes sociais</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">Desempenho</h1>
          <p className="mt-1 text-sm text-ink/60">Registre os resultados durante o mês: o sistema calcula, compara e monta o relatório mensal.</p>
        </div>
      </header>
      <SocialNav clientId={id} current="desempenho" />

      {missing ? (
        <MigrationNotice />
      ) : (
        <>
          <div className="no-scrollbar -mx-1 mb-6 flex gap-5 overflow-x-auto border-b border-wine/15 px-1">
            {TABS.map((t) => (
              <Link key={t.id} href={`/admin/clients/${id}/desempenho${keep({ aba: t.id })}`} aria-current={aba === t.id ? 'page' : undefined} className={cn('-mb-px shrink-0 border-b-2 pb-3 text-sm transition', aba === t.id ? 'border-wine text-wine' : 'border-transparent text-ink/55 hover:text-wine')}>
                {t.label}
              </Link>
            ))}
          </div>

          {aba === 'visao' && <Overview clientId={id} raw={raw} period={period} sp={sp} />}
          {aba === 'perfil' && <ProfileMetricsManager clientId={id} rows={raw.profile} />}
          {aba === 'conteudos' && <ContentsTab clientId={id} raw={raw} period={period} sp={sp} />}
          {aba === 'trafego' && <PaidManager clientId={id} campaigns={raw.campaigns} metrics={raw.campaignMetrics} links={raw.campaignContents} contents={raw.contents as ContentLite[]} months={raw.months} />}
          {aba === 'comparar' && <Compare clientId={id} raw={raw} sp={sp} />}
        </>
      )}
    </div>
  );
}

/** Filtro de período (Este mês · Mês anterior · 3 · 6 meses · Ano · Personalizado). */
function PeriodFilter({ base, period, sp }: { base: string; period: string; sp: SP }) {
  return (
    <div className="mb-6 space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {PERIOD_OPTIONS.map((o) => (
          <Link key={o.id} href={`${base}?aba=${sp.aba ?? 'visao'}&p=${o.id}${o.id === 'custom' && sp.from ? `&from=${sp.from}&to=${sp.to ?? ''}` : ''}`} className={cn('shrink-0 rounded-full border px-4 py-2 text-[0.8rem] transition', period === o.id ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>
            {o.label}
          </Link>
        ))}
      </div>
      {period === 'custom' && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="aba" value={sp.aba ?? 'visao'} />
          <input type="hidden" name="p" value="custom" />
          <label className="text-xs text-ink/60">De<input type="date" name="from" defaultValue={sp.from} max={todayBR()} className="field mt-1 !py-2" /></label>
          <label className="text-xs text-ink/60">Até<input type="date" name="to" defaultValue={sp.to} max={todayBR()} className="field mt-1 !py-2" /></label>
          <button className="rounded-full border border-wine bg-wine px-5 py-2 text-sm text-white">Aplicar</button>
        </form>
      )}
    </div>
  );
}

async function Overview({ clientId, raw, period, sp }: { clientId: string; raw: Awaited<ReturnType<typeof loadPerfRaw>>['raw']; period: ReturnType<typeof parsePeriod>; sp: SP }) {
  const { range, prev } = resolveRange(period, { from: sp.from, to: sp.to });
  const cur = aggregateProfile(raw.profile, range);
  const pr = aggregatePrev(raw.profile, range, prev);
  const before = pr.agg;
  const prevLabel = pr.usedBefore ? (pr.beforeLabel ?? 'Antes') : prev.label;
  const series = profileSeries(raw.profile, range);
  const contents = contentResults(raw, range);
  const paid = paidData(raw, range);
  const formats = formatStats(contents);
  const pillars = pillarStats(contents);
  const ranks = rankings(contents);
  const months = monthlyBreakdown(raw, range);
  const signed = await signPaths(ranks.flatMap((r) => r.entries.map((e) => e.thumbPath)));
  const thumbs: Record<string, string> = {};
  for (const r of ranks) for (const e of r.entries) if (e.thumbPath && signed[e.thumbPath]) thumbs[e.id] = signed[e.thumbPath];
  const insights = autoInsights({ cur, prev: before, contents, formats, pillars, paid });
  const hasAny = cur.periods > 0 || contents.some((c) => c.collected) || !!paid;
  const pendingResults = contents.filter((c) => c.status === 'published' && !c.collected).length;
  const multi = months.length > 1;

  return (
    <div className="space-y-6">
      <PeriodFilter base={`/admin/clients/${clientId}/desempenho`} period={period} sp={sp} />
      <p className="text-sm text-ink/60">Período: <strong className="font-normal text-wine">{range.label}</strong> · comparando com {prevLabel}</p>

      {!hasAny && (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">
          Ainda não há métricas neste período. Cadastre na aba <Link href={`/admin/clients/${clientId}/desempenho?aba=perfil`} className="text-wine underline">Dados do perfil</Link> e no <strong className="font-normal">Desempenho</strong> de cada conteúdo.
        </p>
      )}
      {pendingResults > 0 && <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">{pendingResults} {pendingResults === 1 ? 'publicação ainda não tem' : 'publicações ainda não têm'} resultado cadastrado — veja na aba <Link href={`/admin/clients/${clientId}/desempenho?aba=conteudos&p=${period}`} className="underline">Conteúdos</Link>.</p>}

      <KpiGrid cur={cur} prev={before} prevLabel={prevLabel} />

      {insights.length > 0 && (
        <Block title="Análises automáticas" hint="Geradas só com os dados cadastrados. No relatório mensal você pode editar cada uma.">
          <ul className="space-y-2">
            {insights.map((i) => (
              <li key={i.key} className="flex gap-3 text-[0.95rem] text-ink/80"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-wine" />{i.text}</li>
            ))}
          </ul>
        </Block>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Crescimento de seguidores"><LineChart points={series.followers} ariaLabel="Crescimento de seguidores" /></Block>
        <Block title="Alcance"><BarChart points={series.reach} ariaLabel="Alcance" /></Block>
        <Block title="Engajamento" hint="Taxa de engajamento por alcance (%)">
          <LineChart points={series.er.map((p) => ({ label: p.label, value: p.value == null ? null : Math.round(p.value * 100) / 100 }))} format={(n) => fmtPct(n)} ariaLabel="Engajamento" />
        </Block>
        <Block title="Interações">
          <StackedBars items={series.interactions} keys={[{ key: 'likes', label: 'Curtidas' }, { key: 'comments', label: 'Comentários' }, { key: 'shares', label: 'Compartilhamentos' }, { key: 'saves', label: 'Salvamentos' }]} />
        </Block>
      </div>

      <Block title="Engajamento — taxas"><EngagementRates cur={cur} /></Block>
      <Block title={`${range.label} × ${prevLabel}`}><CompareProfile cur={cur} prev={before} curLabel={range.label} prevLabel={prevLabel} /></Block>

      {multi && (
        <Block title="Evolução mês a mês">
          <div className="grid gap-6 md:grid-cols-2">
            <div><p className="label mb-2 text-wine/70">Seguidores</p><LineChart points={months.map((m) => ({ label: m.label, value: m.profile.followersEnd }))} /></div>
            <div><p className="label mb-2 text-wine/70">Alcance</p><BarChart points={months.map((m) => ({ label: m.label, value: m.profile.reach }))} /></div>
          </div>
        </Block>
      )}

      <Block title="Destaques do período" hint="O melhor conteúdo em cada indicador — não existe um “vencedor” único.">
        <Highlights rankings={ranks} thumbs={thumbs} />
      </Block>
      {ranks.length > 0 && <Block title="Rankings"><RankingLists rankings={ranks} /></Block>}

      <Block title="Comparação por formato"><FormatAnalysis formats={formats} /></Block>
      <Block title="Desempenho por pilar de conteúdo"><PillarAnalysis pillars={pillars} /></Block>
      {objectiveStats(contents).length > 0 && (
        <Block title="Resultado por objetivo">
          <Table head={['Objetivo', 'Conteúdos', 'Indicador', 'Média', 'Melhor conteúdo']} rows={objectiveStats(contents).map((o) => [o.objective, o.count, o.metricLabel, o.metricKey === 'engagement_rate' ? fmtPct(o.value) : fmtDec(o.value), o.best ? `${o.best.title} (${o.metricKey === 'engagement_rate' ? fmtPct(o.best.value) : fmtInt(o.best.value)})` : '–'])} />
        </Block>
      )}

      <Block title="Funil de desempenho" hint="Só aparecem as etapas que têm dados.">
        <FunnelChart steps={funnel(cur, contents, paid)} />
      </Block>

      {paid && (
        <>
          <Block title="Tráfego pago"><PaidAnalysis paid={paid} /></Block>
          <Block title="Orgânico × pago"><OrganicPaidTable rows={organicVsPaid(contents, paid)} /></Block>
        </>
      )}

      {period === 'year' && (
        <Block title={`Resultados do ano ${range.from.slice(0, 4)}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Seguidores conquistados', fmtSigned(months.reduce<Num>((a, m) => (m.profile.net == null ? a : (a ?? 0) + m.profile.net), null))],
              ['Alcance total', fmtInt(cur.reach)],
              ['Engajamentos', fmtInt(cur.interactions)],
              ['Conteúdos publicados', fmtInt(months.reduce((a, m) => a + m.published, 0))],
              ['Investimento em tráfego', fmtMoney(paid?.totals.investment)],
              ['Leads', fmtInt(paid?.totals.leads)],
              ['Conversões', fmtInt((paid?.totals.conversions ?? 0) + months.reduce((a, m) => a + (m.conversions ?? 0), 0) || null)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-blush px-4 py-3"><p className="label text-wine/70">{l}</p><p className="h-display text-2xl text-wine">{v}</p></div>
            ))}
          </div>
          {(() => {
            const withReach = months.filter((m) => m.profile.reach != null);
            const best = [...withReach].sort((a, b) => (b.profile.reach ?? 0) - (a.profile.reach ?? 0)).slice(0, 3);
            return best.length ? <p className="mt-4 text-sm text-ink/70">Melhores meses (alcance): {best.map((m) => `${monthLabel(m.month)} (${fmtInt(m.profile.reach)})`).join(' · ')}</p> : null;
          })()}
        </Block>
      )}
    </div>
  );
}

function ContentsTab({ clientId, raw, period, sp }: { clientId: string; raw: Awaited<ReturnType<typeof loadPerfRaw>>['raw']; period: ReturnType<typeof parsePeriod>; sp: SP }) {
  const { range } = resolveRange(period, { from: sp.from, to: sp.to });
  const list = raw.contents.filter((c) => c.scheduled_date && c.scheduled_date >= range.from && c.scheduled_date <= range.to).sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''));
  const results = new Map(contentResults(raw, range).map((r) => [r.id, r]));
  return (
    <div className="space-y-5">
      <PeriodFilter base={`/admin/clients/${clientId}/desempenho`} period={period} sp={sp} />
      <p className="text-sm text-ink/60">Conteúdos de <strong className="font-normal text-wine">{range.label}</strong>. Abra um conteúdo para registrar o desempenho (aba “Desempenho”).</p>
      {list.length === 0 ? (
        <ChartEmpty>Nenhum conteúdo agendado neste período.</ChartEmpty>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => {
            const r = results.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/admin/content/${c.id}#desempenho`} className="card card-hover flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm text-ink">{c.title}</p>
                    <p className="text-xs text-ink/50">{FORMAT_GROUPS.find((g) => g.id === (c.format === 'video' ? 'reel' : c.format))?.label ?? 'Post'} · {fmtDate(c.scheduled_date, true)}{c.status === 'published' ? ' · publicado' : ''}</p>
                  </div>
                  {r?.collected ? (
                    <p className="text-xs text-ink/65">Alcance {fmtInt(r.metrics.reach ?? r.metrics.views ?? null)} · Eng. {fmtPct(r.metrics.engagement_rate ?? null)} · {r.snapshots} {r.snapshots === 1 ? 'coleta' : 'coletas'}</p>
                  ) : (
                    <span className={cn('rounded-full px-3 py-1 text-xs', c.status === 'published' ? 'bg-wine text-white' : 'bg-ink/5 text-ink/55')}>{c.status === 'published' ? 'Cadastrar resultado' : 'Sem resultado'}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Compare({ clientId, raw, sp }: { clientId: string; raw: Awaited<ReturnType<typeof loadPerfRaw>>['raw']; sp: SP }) {
  const today = todayBR().slice(0, 7);
  const [y, m] = today.split('-').map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const a = /^\d{4}-\d{2}$/.test(sp.a ?? '') ? sp.a! : prevMonth;
  const b = /^\d{4}-\d{2}$/.test(sp.b ?? '') ? sp.b! : today;
  const ra = monthRange(`${a}-01`).range;
  const rb = monthRange(`${b}-01`).range;
  const A = aggregateProfile(raw.profile, ra);
  const B = aggregateProfile(raw.profile, rb);
  const ca = contentResults(raw, ra);
  const cb = contentResults(raw, rb);
  const pa = paidData(raw, ra);
  const pb = paidData(raw, rb);
  const conv = (c: typeof ca, p: typeof pa) => {
    const v = c.reduce((s, x) => s + (x.metrics.conversions ?? 0), 0) + (p?.totals.conversions ?? 0);
    return v || null;
  };
  const rows: [string, Num, Num][] = [
    ['Seguidores', A.followersEnd, B.followersEnd],
    ['Alcance', A.reach, B.reach],
    ['Impressões', A.impressions, B.impressions],
    ['Engajamento (interações)', A.interactions, B.interactions],
    ['Visitas ao perfil', A.visits, B.visits],
    ['Cliques no link', A.linkClicks, B.linkClicks],
    ['Conversões', conv(ca, pa), conv(cb, pb)],
  ];
  return (
    <div className="space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="aba" value="comparar" />
        <label className="text-xs text-ink/60">Período A<input type="month" name="a" defaultValue={a} className="field mt-1 !py-2" /></label>
        <span className="pb-3 text-sm text-wine">VS</span>
        <label className="text-xs text-ink/60">Período B<input type="month" name="b" defaultValue={b} className="field mt-1 !py-2" /></label>
        <button className="rounded-full border border-wine bg-wine px-5 py-2 text-sm text-white">Comparar</button>
      </form>
      <div className="overflow-x-auto rounded-3xl border border-wine/15 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-wine/15 text-wine">
              <th className="label px-4 py-3 font-normal">Indicador</th>
              <th className="label px-4 py-3 text-right font-normal">{monthLabel(`${a}-01`)}</th>
              <th className="label px-4 py-3 text-right font-normal">{monthLabel(`${b}-01`)}</th>
              <th className="label px-4 py-3 text-right font-normal">Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([l, x, z]) => {
              const d = delta(z, x);
              return (
                <tr key={l} className="border-b border-wine/10 last:border-0">
                  <td className="px-4 py-3 text-ink">{l}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink/80">{fmtInt(x)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink/80">{fmtInt(z)}</td>
                  <td className="px-4 py-3 text-right">{d.dir ? <span className="inline-flex items-center gap-2"><DeltaPill d={d} /><span className="text-xs text-ink/45">{fmtSigned(d.abs)}</span></span> : <span className="text-ink/40">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/45">A variação mostra quanto o período B mudou em relação ao período A ({fmtSignedPct(delta(B.reach, A.reach).pct)} no alcance, por exemplo). Dados de cada mês ficam guardados — nada é sobrescrito. <Link href={`/admin/clients/${clientId}/desempenho`} className="text-wine underline">Voltar à visão geral</Link></p>
    </div>
  );
}
