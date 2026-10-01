/**
 * Monta os dados de um relatório mensal (puro) e mescla as análises automáticas
 * com os textos editados pela administradora.
 */
import {
  aggregateProfile,
  autoInsights,
  contentResults,
  formatStats,
  funnel,
  monthLabel,
  monthRange,
  objectiveStats,
  organicVsPaid,
  paidData,
  pillarStats,
  profileSeries,
  rankings,
  type ContentResult,
  type FormatStat,
  type FunnelStep,
  type ObjectiveStat,
  type OrganicPaidRow,
  type PaidData,
  type PerfRaw,
  type PillarStat,
  type ProfileAgg,
  type ProfileSeries,
  type Range,
  type Ranking,
  type AutoInsight,
} from './calc';
import { EMPTY_EDITS, FORMAT_GROUPS, type FormatGroup, type Insight, type ReportEdits } from './types';

export interface ReportClientInfo {
  name: string;
  handle: string;
  /** caminho do logo/avatar no Storage (assinado só na hora de exibir) */
  logoPath: string | null;
  /** cores da marca, quando cadastradas na Identidade Visual */
  colors: string[];
}

export interface ReportData {
  month: string;
  label: string;
  generatedAt: string;
  client: ReportClientInfo;
  range: Range;
  prevRange: Range;
  hasData: boolean;
  profile: { cur: ProfileAgg; prev: ProfileAgg; series: ProfileSeries; prevSeries: ProfileSeries };
  published: { total: number; byFormat: Record<FormatGroup, number> };
  contents: ContentResult[];
  rankings: Ranking[];
  formats: FormatStat[];
  pillars: PillarStat[];
  objectives: ObjectiveStat[];
  paid: PaidData | null;
  organicPaid: OrganicPaidRow[];
  funnel: FunnelStep[];
  autoInsights: AutoInsight[];
}

export function buildReportData(raw: PerfRaw, month: string, client: ReportClientInfo): ReportData {
  const { range, prev } = monthRange(month);
  const cur = aggregateProfile(raw.profile, range);
  const prevAgg = aggregateProfile(raw.profile, prev);
  const contents = contentResults(raw, range);
  const formats = formatStats(contents);
  const pillars = pillarStats(contents);
  const paid = paidData(raw, range);
  const byFormat = Object.fromEntries(FORMAT_GROUPS.map((g) => [g.id, contents.filter((c) => c.group === g.id).length])) as Record<FormatGroup, number>;
  const hasData = cur.periods > 0 || contents.some((c) => c.collected) || !!paid?.totals.investment;
  return {
    month,
    label: monthLabel(month),
    generatedAt: new Date().toISOString(),
    client,
    range,
    prevRange: prev,
    hasData,
    profile: { cur, prev: prevAgg, series: profileSeries(raw.profile, range), prevSeries: profileSeries(raw.profile, prev) },
    published: { total: contents.length, byFormat },
    contents,
    rankings: rankings(contents),
    formats,
    pillars,
    objectives: objectiveStats(contents),
    paid,
    organicPaid: organicVsPaid(contents, paid),
    funnel: funnel(cur, contents, paid),
    autoInsights: autoInsights({ cur, prev: prevAgg, contents, formats, pillars, paid }),
  };
}

export const normalizeEdits = (raw: unknown): ReportEdits => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReportEdits>;
  return {
    texts: { ...EMPTY_EDITS.texts, ...(r.texts ?? {}) },
    analyses: { ...(r.analyses ?? {}) },
    titles: { ...(r.titles ?? {}) },
    insights: Array.isArray(r.insights) ? r.insights : [],
    internal_notes: typeof r.internal_notes === 'string' ? r.internal_notes : '',
  };
};

/**
 * Mescla as análises automáticas atuais com as já existentes: mantém o que foi editado/escrito,
 * atualiza o texto das automáticas não editadas e remove automáticas que deixaram de existir.
 */
export function mergeInsights(existing: Insight[], auto: AutoInsight[]): Insight[] {
  const out: Insight[] = [];
  for (const a of auto) {
    const cur = existing.find((i) => i.key === a.key);
    out.push(cur ? { ...cur, text: cur.edited ? cur.text : a.text } : { id: `auto-${a.key}`, key: a.key, text: a.text, enabled: true, edited: false });
  }
  for (const i of existing) {
    if (!auto.some((a) => a.key === i.key) && (!i.key || i.edited)) out.push(i);
  }
  return out;
}

/** O que o cliente pode receber: sem observações internas. */
export const publicEdits = (e: ReportEdits): ReportEdits => ({ ...e, internal_notes: '', insights: e.insights.filter((i) => i.enabled) });
