import { Logo } from '@/components/brand/Brand';
import { cn } from '@/lib/utils';
import { fmtInt, fmtPct, fmtSigned, fmtDec } from '@/lib/perf/calc';
import type { ReportData } from '@/lib/perf/report';
import { visibleSections } from '@/lib/perf/sections';
import type { ReportEdits } from '@/lib/perf/types';
import { FORMAT_GROUPS } from '@/lib/perf/types';
import { BarChart, ChartEmpty, FunnelChart, LineChart, StackedBars } from './charts';
import { CompareProfile, EngagementRates, FormatAnalysis, Highlights, KpiGrid, OrganicPaidTable, PaidAnalysis, PillarAnalysis, Table } from './blocks';

const Text = ({ children }: { children?: string }) => (children?.trim() ? <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{children}</p> : null);

function Analysis({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="mt-5 rounded-2xl bg-blush px-5 py-4">
      <p className="label mb-1 text-wine">Análise</p>
      <Text>{text}</Text>
    </div>
  );
}

function Page({ number, title, accent, children, paper }: { number: string; title: string; accent?: string; children: React.ReactNode; paper?: boolean }) {
  return (
    <section className={cn('border-wine/15 bg-white', paper ? 'break-inside-avoid-page rounded-sm border p-6 shadow-sm sm:p-10' : 'rounded-[1.75rem] border p-5 sm:p-8')} style={accent ? { borderTop: `4px solid ${accent}` } : undefined}>
      <header className="mb-6 flex items-baseline gap-3 border-b border-wine/15 pb-3">
        <span className="label text-wine/60">{number}</span>
        <h2 className="h-display text-3xl text-wine sm:text-4xl">{title}</h2>
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/**
 * Relatório mensal na tela (painel, preview e portal do cliente).
 * Mesmas seções e mesma regra de "só aparece o que tem dado" do PDF.
 * `paper` = aparência de folha A4 (preview no desktop).
 */
export function ReportDocument({ data, edits, thumbs, logo, paper = false }: { data: ReportData; edits: ReportEdits; thumbs: Record<string, string>; logo: string | null; paper?: boolean }) {
  const sections = visibleSections(data, edits);
  const { cur, prev, series } = data.profile;
  const accent = data.client.colors[0];
  const t = edits.texts;
  const insights = edits.insights.filter((i) => i.enabled && i.text.trim());
  const an = edits.analyses;

  return (
    <article className={cn('space-y-6', paper && 'mx-auto max-w-[860px]')}>
      {/* capa */}
      <header className={cn('relative overflow-hidden bg-wine p-8 text-white sm:p-12', paper ? 'rounded-sm shadow-sm' : 'rounded-[1.75rem]')} style={accent ? { boxShadow: `inset 0 -6px 0 ${accent}` } : undefined}>
        <div className="flex items-start justify-between gap-6">
          <Logo tone="light" withTagline className="w-44 sm:w-56" />
          {logo && (
            <img src={logo} alt={data.client.name} className="size-16 rounded-full border-2 border-white/40 object-cover sm:size-20" />
          )}
        </div>
        <p className="label mt-14 text-white/70">Relatório de desempenho · Instagram</p>
        <h1 className="h-display mt-2 text-4xl sm:text-6xl">{data.client.name}</h1>
        <p className="h-display mt-2 text-2xl text-blush sm:text-3xl">{data.label}</p>
        {data.client.handle && <p className="mt-6 text-sm text-white/70">@{data.client.handle.replace(/^@/, '')}</p>}
      </header>

      {sections.map((s) => (
        <Page key={s.id} number={s.number} title={s.title} accent={accent} paper={paper}>
          {s.id === 'overview' && (
            <>
              <KpiGrid cur={cur} prev={prev} prevLabel={data.prevRange.label} />
              {!data.hasData && <ChartEmpty>Ainda não há métricas cadastradas para {data.label}.</ChartEmpty>}
              {t.summary?.trim() && (
                <div>
                  <p className="label mb-2 text-wine">Resumo do mês</p>
                  <Text>{t.summary}</Text>
                </div>
              )}
              {t.results?.trim() && (
                <div>
                  <p className="label mb-2 text-wine">Principais resultados</p>
                  <Text>{t.results}</Text>
                </div>
              )}
              {insights.length > 0 && (
                <ul className="space-y-2">
                  {insights.map((i) => (
                    <li key={i.id} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink/80">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-wine" />
                      {i.text}
                    </li>
                  ))}
                </ul>
              )}
              {data.funnel.length > 0 && (
                <div>
                  <p className="label mb-3 text-wine">Funil de desempenho</p>
                  <FunnelChart steps={data.funnel} />
                </div>
              )}
            </>
          )}

          {s.id === 'growth' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Novos', fmtInt(cur.newFollowers)], ['Perdidos', fmtInt(cur.lostFollowers)], ['Crescimento líquido', fmtSigned(cur.net)], ['Taxa de crescimento', fmtPct(cur.growthPct)]].map(([l, v]) => (
                  <div key={l} className="rounded-2xl bg-blush px-4 py-3">
                    <p className="label text-wine/70">{l}</p>
                    <p className="h-display text-2xl text-wine">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="label mb-2 text-wine/70">Seguidores</p>
                <LineChart points={series.followers} ariaLabel="Crescimento de seguidores" />
              </div>
              <div>
                <p className="label mb-3 text-wine/70">{data.label} × {data.prevRange.label}</p>
                <CompareProfile cur={cur} prev={prev} curLabel={data.label} prevLabel={data.prevRange.label} />
              </div>
              <Analysis text={an.growth} />
            </>
          )}

          {s.id === 'reach' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[['Alcance', fmtInt(cur.reach)], ['Impressões', fmtInt(cur.impressions)], ['Visualizações', fmtInt(cur.views)]].map(([l, v]) => (
                  <div key={l} className="rounded-2xl bg-blush px-4 py-3">
                    <p className="label text-wine/70">{l}</p>
                    <p className="h-display text-2xl text-wine">{v}</p>
                  </div>
                ))}
              </div>
              {series.reach.length > 0 && (
                <div>
                  <p className="label mb-2 text-wine/70">Alcance ao longo do período</p>
                  <BarChart points={series.reach} ariaLabel="Alcance" />
                </div>
              )}
              {series.impressions.length > 0 && (
                <div>
                  <p className="label mb-2 text-wine/70">Impressões ao longo do período</p>
                  <LineChart points={series.impressions} ariaLabel="Impressões" color="#c9707f" />
                </div>
              )}
              <Analysis text={an.reach} />
            </>
          )}

          {s.id === 'engagement' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Curtidas', fmtInt(cur.likes)], ['Comentários', fmtInt(cur.comments)], ['Compartilhamentos', fmtInt(cur.shares)], ['Salvamentos', fmtInt(cur.saves)]].map(([l, v]) => (
                  <div key={l} className="rounded-2xl bg-blush px-4 py-3">
                    <p className="label text-wine/70">{l}</p>
                    <p className="h-display text-2xl text-wine">{v}</p>
                  </div>
                ))}
              </div>
              <EngagementRates cur={cur} />
              <div>
                <p className="label mb-2 text-wine/70">Interações por tipo</p>
                <StackedBars items={series.interactions} keys={[{ key: 'likes', label: 'Curtidas' }, { key: 'comments', label: 'Comentários' }, { key: 'shares', label: 'Compartilhamentos' }, { key: 'saves', label: 'Salvamentos' }]} />
              </div>
              {series.er.length > 0 && (
                <div>
                  <p className="label mb-2 text-wine/70">Evolução da taxa de engajamento (por alcance, %)</p>
                  <LineChart points={series.er.map((p) => ({ label: p.label, value: p.value == null ? null : Math.round(p.value * 100) / 100 }))} format={(n) => fmtPct(n)} ariaLabel="Taxa de engajamento" />
                </div>
              )}
              <Analysis text={an.engagement} />
            </>
          )}

          {s.id === 'published' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FORMAT_GROUPS.map((g) => (
                <div key={g.id} className="rounded-2xl bg-blush px-4 py-3">
                  <p className="label text-wine/70">{g.plural}</p>
                  <p className="h-display text-3xl text-wine">{data.published.byFormat[g.id]}</p>
                </div>
              ))}
            </div>
          )}

          {s.id === 'highlights' && (
            <>
              <Highlights rankings={data.rankings} thumbs={thumbs} />
              <Analysis text={an.highlights} />
            </>
          )}

          {s.id === 'formats' && (
            <>
              <FormatAnalysis formats={data.formats} />
              <Analysis text={an.formats} />
            </>
          )}

          {s.id === 'pillars' && (
            <>
              <PillarAnalysis pillars={data.pillars} />
              {data.objectives.length > 0 && (
                <div>
                  <p className="label mb-3 text-wine/70">Resultado por objetivo do conteúdo</p>
                  <Table head={['Objetivo', 'Conteúdos', 'Indicador', 'Média', 'Melhor conteúdo']} rows={data.objectives.map((o) => [o.objective, o.count, o.metricLabel, o.metricKey === 'engagement_rate' ? fmtPct(o.value) : fmtDec(o.value), o.best ? `${o.best.title} (${o.metricKey === 'engagement_rate' ? fmtPct(o.best.value) : fmtInt(o.best.value)})` : '–'])} />
                </div>
              )}
              <Analysis text={an.pillars} />
            </>
          )}

          {s.id === 'paid' && data.paid && (
            <>
              <PaidAnalysis paid={data.paid} />
              <Analysis text={an.paid} />
            </>
          )}

          {s.id === 'organic_paid' && <OrganicPaidTable rows={data.organicPaid} />}

          {s.id === 'learnings' && (
            <>
              {[['O que funcionou', t.worked], ['O que pode melhorar', t.improve], ['Aprendizados', t.learnings]].map(([l, v]) => (v?.trim() ? (
                <div key={l}>
                  <p className="label mb-2 text-wine">{l}</p>
                  <Text>{v}</Text>
                </div>
              ) : null))}
            </>
          )}

          {s.id === 'recommendations' && <Text>{t.recommendations}</Text>}

          {s.id === 'next' && (
            <>
              {[['Objetivos', t.next_goals], ['Testes', t.next_tests], ['Pilares prioritários', t.next_pillars], ['Formatos', t.next_formats], ['Próximos passos', t.next_steps]].map(([l, v]) => (v?.trim() ? (
                <div key={l}>
                  <p className="label mb-2 text-wine">{l}</p>
                  <Text>{v}</Text>
                </div>
              ) : null))}
            </>
          )}
        </Page>
      ))}

      <p className="pb-2 text-center text-xs text-ink/40">Relatório gerado pela Soltria · {data.label}</p>
    </article>
  );
}
