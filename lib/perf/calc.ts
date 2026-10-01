/**
 * DESEMPENHO — cálculos puros (sem banco, sem React).
 * Recebem os registros já cadastrados e devolvem indicadores, rankings, comparativos
 * e análises automáticas. Nada aqui inventa dado: sem informação → `null` (mostrado como "–").
 */
import {
  CONTENT_METRIC_KEYS,
  FORMAT_GROUPS,
  OBJECTIVE_METRIC,
  toFormatGroup,
  type CampaignContentRow,
  type CampaignMetricRow,
  type CampaignRow,
  type ContentLite,
  type FormatGroup,
  type MetaRow,
  type MonthConfigRow,
  type ProfileRow,
  type SnapshotRow,
} from './types';

// ─── datas (strings AAAA-MM-DD, sempre em UTC para não "escorregar" de dia) ──
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
export const addMonths = (s: string, n: number) => {
  const d = parse(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
};
export const monthEnd = (s: string) => {
  const d = parse(addMonths(s, 1));
  d.setUTCDate(0);
  return iso(d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
/** Data de hoje no fuso de São Paulo. */
export const todayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthName = (s: string) => MONTHS[parse(s).getUTCMonth()];
export const monthLabel = (s: string) => `${monthName(s)} ${s.slice(0, 4)}`;
export const monthShort = (s: string) => `${monthName(s).slice(0, 3)}/${s.slice(2, 4)}`;
export const dayMonth = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

// ─── formatação pt-BR ───────────────────────────────────────────────────────
const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtInt = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : nf.format(n));
export const fmtDec = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : nf1.format(n));
export const fmtPct = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : `${nf2.format(n)}%`.replace(',00%', '%'));
export const fmtMoney = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : brl.format(n));
export const fmtRatio = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : `${nf2.format(n)}x`);
export const fmtSigned = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${nf.format(Math.abs(n))}`);
export const fmtSignedPct = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${nf2.format(Math.abs(n)).replace(',00', '')}%`);

// ─── períodos / filtros ─────────────────────────────────────────────────────
export type PeriodKey = 'this_month' | 'last_month' | '3m' | '6m' | 'year' | 'custom';
export const PERIOD_OPTIONS: { id: PeriodKey; label: string }[] = [
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês anterior' },
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: 'year', label: 'Ano' },
  { id: 'custom', label: 'Período personalizado' },
];
export const parsePeriod = (v: string | undefined): PeriodKey => (PERIOD_OPTIONS.some((p) => p.id === v) ? (v as PeriodKey) : 'this_month');

export interface Range {
  from: string;
  to: string;
  label: string;
}
const rangeLabel = (from: string, to: string) => {
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01') && to === monthEnd(from)) return monthLabel(from);
  return `${dayMonth(from)}/${from.slice(0, 4)} a ${dayMonth(to)}/${to.slice(0, 4)}`;
};
const mk = (from: string, to: string): Range => ({ from, to, label: rangeLabel(from, to) });

export function resolveRange(key: PeriodKey, custom?: { from?: string; to?: string }, today = todayBR()): { range: Range; prev: Range } {
  const m0 = monthStart(today);
  if (key === 'last_month') {
    const a = addMonths(m0, -1);
    const b = addMonths(m0, -2);
    return { range: mk(a, monthEnd(a)), prev: mk(b, monthEnd(b)) };
  }
  if (key === '3m' || key === '6m') {
    const n = key === '3m' ? 3 : 6;
    const a = addMonths(m0, -(n - 1));
    const pa = addMonths(a, -n);
    return { range: mk(a, monthEnd(m0)), prev: mk(pa, monthEnd(addMonths(pa, n - 1))) };
  }
  if (key === 'year') {
    const y = today.slice(0, 4);
    const py = String(Number(y) - 1);
    return { range: mk(`${y}-01-01`, `${y}-12-31`), prev: mk(`${py}-01-01`, `${py}-12-31`) };
  }
  if (key === 'custom' && custom?.from && custom?.to && custom.from <= custom.to) {
    const len = daysBetween(custom.from, custom.to) + 1;
    return { range: mk(custom.from, custom.to), prev: mk(addDays(custom.from, -len), addDays(custom.from, -1)) };
  }
  const pm = addMonths(m0, -1);
  return { range: mk(m0, monthEnd(m0)), prev: mk(pm, monthEnd(pm)) };
}
/** Período = um mês específico (usado no relatório mensal). */
export function monthRange(month: string): { range: Range; prev: Range } {
  const a = monthStart(month);
  const p = addMonths(a, -1);
  return { range: mk(a, monthEnd(a)), prev: mk(p, monthEnd(p)) };
}
const inRange = (d: string | null | undefined, r: Range) => !!d && d >= r.from && d <= r.to;

// ─── variação ───────────────────────────────────────────────────────────────
export interface Delta {
  abs: number | null;
  pct: number | null;
  dir: 'up' | 'down' | 'flat' | null;
}
export function delta(cur: number | null | undefined, prev: number | null | undefined): Delta {
  if (cur == null || prev == null) return { abs: null, pct: null, dir: null };
  const abs = cur - prev;
  const pct = prev !== 0 ? (abs / Math.abs(prev)) * 100 : null;
  return { abs, pct, dir: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat' };
}
const div = (a: number | null, b: number | null, mult = 1) => (a == null || b == null || b === 0 ? null : (a / b) * mult);

// ─── perfil ─────────────────────────────────────────────────────────────────
export type Num = number | null;
const sum = (vals: Num[]): Num => {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};

export interface ProfileAgg {
  periods: number;
  followersStart: Num;
  followersEnd: Num;
  newFollowers: Num;
  lostFollowers: Num;
  /** crescimento líquido = seguidores finais − iniciais */
  net: Num;
  /** taxa de crescimento = líquido ÷ seguidores iniciais × 100 */
  growthPct: Num;
  reach: Num;
  impressions: Num;
  views: Num;
  visits: Num;
  linkClicks: Num;
  contactClicks: Num;
  messages: Num;
  likes: Num;
  comments: Num;
  shares: Num;
  saves: Num;
  replies: Num;
  stickerTaps: Num;
  interactions: Num;
  /** interações ÷ seguidores × 100 */
  erFollowers: Num;
  /** interações ÷ alcance × 100 */
  erReach: Num;
}

const rowInteractions = (r: ProfileRow): Num => (r.interactions != null ? r.interactions : sum([r.likes, r.comments, r.shares, r.saves, r.replies]));

export function aggregateProfile(rows: ProfileRow[], range: Range): ProfileAgg {
  const list = rows.filter((r) => inRange(r.period_start, range)).sort((a, b) => a.period_start.localeCompare(b.period_start));
  const s = (k: keyof ProfileRow) => sum(list.map((r) => r[k] as Num));
  const first = list.find((r) => r.followers_start != null)?.followers_start ?? null;
  const last = [...list].reverse().find((r) => r.followers_end != null)?.followers_end ?? null;
  const newF = s('new_followers');
  const lostF = s('lost_followers');
  let net: Num = first != null && last != null ? last - first : newF != null ? newF - (lostF ?? 0) : null;
  const interactions = sum(list.map(rowInteractions));
  const reach = s('reach');
  if (!list.length) net = null;
  return {
    periods: list.length,
    followersStart: first,
    followersEnd: last,
    newFollowers: newF,
    lostFollowers: lostF,
    net,
    growthPct: div(net, first, 100),
    reach,
    impressions: s('impressions'),
    views: s('views'),
    visits: s('profile_visits'),
    linkClicks: s('link_clicks'),
    contactClicks: s('contact_clicks'),
    messages: s('messages'),
    likes: s('likes'),
    comments: s('comments'),
    shares: s('shares'),
    saves: s('saves'),
    replies: s('replies'),
    stickerTaps: s('sticker_taps'),
    interactions,
    erFollowers: div(interactions, last, 100),
    erReach: div(interactions, reach, 100),
  };
}

export interface SeriesPoint {
  label: string;
  value: number | null;
}
export interface ProfileSeries {
  followers: SeriesPoint[];
  reach: SeriesPoint[];
  impressions: SeriesPoint[];
  er: SeriesPoint[];
  /** interações separadas por tipo, um item por período */
  interactions: { label: string; likes: number; comments: number; shares: number; saves: number }[];
}
export function profileSeries(rows: ProfileRow[], range: Range): ProfileSeries {
  const list = rows.filter((r) => inRange(r.period_start, range)).sort((a, b) => a.period_start.localeCompare(b.period_start));
  const lbl = (r: ProfileRow) => (r.period_start === r.period_end ? dayMonth(r.period_end) : `${dayMonth(r.period_start)}–${dayMonth(r.period_end)}`);
  const followers: SeriesPoint[] = [];
  if (list[0]?.followers_start != null) followers.push({ label: dayMonth(list[0].period_start), value: list[0].followers_start });
  for (const r of list) if (r.followers_end != null) followers.push({ label: dayMonth(r.period_end), value: r.followers_end });
  return {
    followers,
    reach: list.filter((r) => r.reach != null).map((r) => ({ label: lbl(r), value: r.reach })),
    impressions: list.filter((r) => r.impressions != null).map((r) => ({ label: lbl(r), value: r.impressions })),
    er: list
      .map((r) => ({ label: lbl(r), value: div(rowInteractions(r), r.reach, 100) }))
      .filter((p) => p.value != null),
    interactions: list
      .filter((r) => r.likes != null || r.comments != null || r.shares != null || r.saves != null)
      .map((r) => ({ label: lbl(r), likes: r.likes ?? 0, comments: r.comments ?? 0, shares: r.shares ?? 0, saves: r.saves ?? 0 })),
  };
}

// ─── conteúdos ──────────────────────────────────────────────────────────────
export interface ContentResult {
  id: string;
  title: string;
  format: string;
  group: FormatGroup;
  status: string;
  date: string | null;
  thumbPath: string | null;
  tags: string[];
  objectives: string[];
  metrics: Record<string, number>;
  /** de qual coleta vêm os números */
  collected: { on: string; label: string; final: boolean } | null;
  snapshots: number;
}

/** Resultado final da publicação: o snapshot marcado como final; senão, o mais recente. */
export function pickSnapshot(list: SnapshotRow[]): SnapshotRow | null {
  if (!list.length) return null;
  return list.find((s) => s.is_final) ?? [...list].sort((a, b) => b.collected_on.localeCompare(a.collected_on) || b.created_at.localeCompare(a.created_at))[0];
}

/** Completa o que dá para calcular (interações, taxa de engajamento, cliques). */
export function normalizeMetrics(raw: Record<string, number>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const k of CONTENT_METRIC_KEYS) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) m[k] = raw[k];
  if (m.clicks == null && m.link_clicks != null) m.clicks = m.link_clicks;
  if (m.interactions == null) {
    const parts = ['likes', 'comments', 'shares', 'saves', 'replies'].filter((k) => m[k] != null);
    if (parts.length) m.interactions = parts.reduce((a, k) => a + m[k], 0);
  }
  if (m.engagement_rate == null && m.interactions != null) {
    const base = m.reach ?? m.views;
    if (base) m.engagement_rate = (m.interactions / base) * 100;
  }
  return m;
}

export interface PerfRaw {
  profile: ProfileRow[];
  contents: (ContentLite & { thumbPath: string | null })[];
  meta: MetaRow[];
  snapshots: SnapshotRow[];
  campaigns: CampaignRow[];
  campaignMetrics: CampaignMetricRow[];
  campaignContents: CampaignContentRow[];
  months: MonthConfigRow[];
}

export function contentResults(raw: PerfRaw, range: Range): ContentResult[] {
  const metaBy = new Map(raw.meta.map((m) => [m.content_id, m]));
  const snapsBy = new Map<string, SnapshotRow[]>();
  for (const s of raw.snapshots) snapsBy.set(s.content_id, [...(snapsBy.get(s.content_id) ?? []), s]);
  const out: ContentResult[] = [];
  for (const c of raw.contents) {
    if (!inRange(c.scheduled_date, range)) continue;
    const snaps = snapsBy.get(c.id) ?? [];
    if (!snaps.length && c.status !== 'published') continue;
    const pick = pickSnapshot(snaps);
    const meta = metaBy.get(c.id);
    out.push({
      id: c.id,
      title: c.title,
      format: c.format,
      group: toFormatGroup(c.format),
      status: c.status,
      date: c.scheduled_date,
      thumbPath: c.thumbPath,
      tags: meta?.tags ?? [],
      objectives: meta?.objectives ?? [],
      metrics: pick ? normalizeMetrics(pick.metrics) : {},
      collected: pick ? { on: pick.collected_on, label: pick.label, final: pick.is_final } : null,
      snapshots: snaps.length,
    });
  }
  return out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

const avg = (vals: Num[]): Num => {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const mv = (c: ContentResult, k: string): Num => c.metrics[k] ?? null;

export interface RankingDef {
  id: string;
  title: string;
  metric: string;
  unit: 'int' | 'pct';
  groups?: FormatGroup[];
  unitLabel: string;
}
export const RANKING_DEFS: RankingDef[] = [
  { id: 'reach', title: 'Maior alcance', metric: 'reach', unit: 'int', unitLabel: 'pessoas alcançadas' },
  { id: 'engagement', title: 'Maior engajamento', metric: 'engagement_rate', unit: 'pct', unitLabel: 'de engajamento' },
  { id: 'saves', title: 'Mais salvo', metric: 'saves', unit: 'int', unitLabel: 'salvamentos' },
  { id: 'shares', title: 'Mais compartilhado', metric: 'shares', unit: 'int', unitLabel: 'compartilhamentos' },
  { id: 'comments', title: 'Mais comentado', metric: 'comments', unit: 'int', unitLabel: 'comentários' },
  { id: 'clicks', title: 'Maior número de cliques', metric: 'clicks', unit: 'int', unitLabel: 'cliques' },
  { id: 'followers', title: 'Maior crescimento de seguidores', metric: 'new_followers', unit: 'int', unitLabel: 'novos seguidores' },
  { id: 'reel', title: 'Reel mais assistido', metric: 'views', unit: 'int', groups: ['reel'], unitLabel: 'visualizações' },
  { id: 'story', title: 'Story com mais cliques', metric: 'clicks', unit: 'int', groups: ['story'], unitLabel: 'cliques' },
];
export interface RankingEntry {
  id: string;
  title: string;
  format: string;
  group: FormatGroup;
  value: number;
  thumbPath: string | null;
}
export interface Ranking {
  def: RankingDef;
  entries: RankingEntry[];
}
export function rankings(contents: ContentResult[], top = 5): Ranking[] {
  const out: Ranking[] = [];
  for (const def of RANKING_DEFS) {
    const entries = contents
      .filter((c) => !def.groups || def.groups.includes(c.group))
      .map((c) => ({ id: c.id, title: c.title, format: c.format, group: c.group, value: mv(c, def.metric) ?? 0, thumbPath: c.thumbPath }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, top);
    if (entries.length) out.push({ def, entries });
  }
  return out;
}

export interface FormatStat {
  group: FormatGroup;
  label: string;
  plural: string;
  count: number;
  reach: Num;
  er: Num;
  shares: Num;
  saves: Num;
  clicks: Num;
  conversions: Num;
}
export function formatStats(contents: ContentResult[]): FormatStat[] {
  const out: FormatStat[] = [];
  for (const g of FORMAT_GROUPS) {
    const list = contents.filter((c) => c.group === g.id && c.collected);
    if (!list.length) continue;
    out.push({
      group: g.id,
      label: g.label,
      plural: g.plural,
      count: list.length,
      reach: avg(list.map((c) => mv(c, 'reach') ?? (g.id === 'story' || g.id === 'reel' ? mv(c, 'views') : null))),
      er: avg(list.map((c) => mv(c, 'engagement_rate'))),
      shares: avg(list.map((c) => mv(c, 'shares'))),
      saves: avg(list.map((c) => mv(c, 'saves'))),
      clicks: avg(list.map((c) => mv(c, 'clicks'))),
      conversions: sum(list.map((c) => mv(c, 'conversions'))),
    });
  }
  return out;
}

export interface PillarStat {
  tag: string;
  count: number;
  reach: Num;
  er: Num;
  saves: Num;
  clicks: Num;
  conversions: Num;
}
export function pillarStats(contents: ContentResult[]): PillarStat[] {
  const tags = new Map<string, ContentResult[]>();
  for (const c of contents) if (c.collected) for (const t of c.tags) tags.set(t, [...(tags.get(t) ?? []), c]);
  return [...tags.entries()]
    .map(([tag, list]) => ({
      tag,
      count: list.length,
      reach: avg(list.map((c) => mv(c, 'reach'))),
      er: avg(list.map((c) => mv(c, 'engagement_rate'))),
      saves: avg(list.map((c) => mv(c, 'saves'))),
      clicks: avg(list.map((c) => mv(c, 'clicks'))),
      conversions: sum(list.map((c) => mv(c, 'conversions'))),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface ObjectiveStat {
  objective: string;
  count: number;
  metricLabel: string;
  metricKey: string;
  value: Num;
  best: { title: string; value: number } | null;
}
export function objectiveStats(contents: ContentResult[]): ObjectiveStat[] {
  const map = new Map<string, ContentResult[]>();
  for (const c of contents) if (c.collected) for (const o of c.objectives) map.set(o, [...(map.get(o) ?? []), c]);
  return [...map.entries()].map(([objective, list]) => {
    const m = OBJECTIVE_METRIC[objective] ?? OBJECTIVE_METRIC.Alcance;
    const vals = list.map((c) => ({ c, v: mv(c, m.key) }));
    const best = vals.filter((x): x is { c: ContentResult; v: number } => x.v != null && x.v > 0).sort((a, b) => b.v - a.v)[0];
    return { objective, count: list.length, metricKey: m.key, metricLabel: m.label, value: avg(vals.map((x) => x.v)), best: best ? { title: best.c.title, value: best.v } : null };
  });
}

// ─── tráfego pago ───────────────────────────────────────────────────────────
export interface PaidTotals {
  investment: Num;
  impressions: Num;
  reach: Num;
  frequency: Num;
  clicks: Num;
  linkClicks: Num;
  views: Num;
  leads: Num;
  conversions: Num;
  purchases: Num;
  messages: Num;
  revenue: Num;
  /** CTR = cliques ÷ impressões × 100 */
  ctr: Num;
  /** CPC = investimento ÷ cliques */
  cpc: Num;
  /** CPM = investimento ÷ impressões × 1000 */
  cpm: Num;
  /** CPL = investimento ÷ leads */
  cpl: Num;
  /** CPA = investimento ÷ conversões */
  cpa: Num;
  /** custo por mensagem = investimento ÷ mensagens */
  cpMessage: Num;
  /** ROAS = receita ÷ investimento */
  roas: Num;
}
/** Soma métricas de tráfego pago e calcula os indicadores derivados (denominador zero → null). */
export function paidTotals(rows: Record<string, number>[]): PaidTotals {
  const s = (k: string) => sum(rows.map((r) => (typeof r[k] === 'number' ? r[k] : null)));
  const investment = s('investment');
  const impressions = s('impressions');
  const clicks = s('clicks');
  const leads = s('leads');
  const conversions = s('conversions');
  const messages = s('messages');
  const revenue = s('revenue');
  const freqVals = rows.map((r) => r.frequency).filter((x): x is number => typeof x === 'number');
  return {
    investment,
    impressions,
    reach: s('reach'),
    frequency: freqVals.length ? freqVals.reduce((a, b) => a + b, 0) / freqVals.length : null,
    clicks,
    linkClicks: s('link_clicks'),
    views: s('views'),
    leads,
    conversions,
    purchases: s('purchases'),
    messages,
    revenue,
    ctr: div(clicks, impressions, 100),
    cpc: div(investment, clicks),
    cpm: div(investment, impressions, 1000),
    cpl: div(investment, leads),
    cpa: div(investment, conversions),
    cpMessage: div(investment, messages),
    roas: div(revenue, investment),
  };
}

export interface PaidCampaignResult {
  id: string;
  name: string;
  platform: string;
  objective: string;
  status: string;
  totals: PaidTotals;
  contentIds: string[];
}
export interface OrganicPaidRow {
  contentId: string;
  title: string;
  format: string;
  thumbPath: string | null;
  campaigns: string[];
  organic: { reach: Num; er: Num; clicks: Num };
  paid: { reach: Num; impressions: Num; clicks: Num; conversions: Num; investment: Num };
  /** só o que não gera duplicidade entre orgânico e pago */
  total: { clicks: Num; conversions: Num };
}
export interface PaidData {
  enabled: boolean;
  totals: PaidTotals;
  campaigns: PaidCampaignResult[];
  byMonth: { month: string; label: string; totals: PaidTotals }[];
}

export function paidData(raw: PerfRaw, range: Range): PaidData | null {
  const months = new Set<string>();
  for (let m = monthStart(range.from); m <= range.to; m = addMonths(m, 1)) months.add(m);
  const enabledByConfig = raw.months.some((m) => m.uses_paid && months.has(m.month));
  // "Usou tráfego pago neste mês? NÃO" esconde o mês, mesmo que haja números cadastrados
  const off = new Set(raw.months.filter((m) => !m.uses_paid).map((m) => m.month));
  const metricRows = raw.campaignMetrics.filter((r) => months.has(r.month) && !off.has(r.month));
  if (!enabledByConfig && !metricRows.length) return null;
  const campaigns: PaidCampaignResult[] = [];
  for (const c of raw.campaigns) {
    const rows = metricRows.filter((r) => r.campaign_id === c.id);
    if (!rows.length) continue;
    campaigns.push({
      id: c.id,
      name: c.name,
      platform: c.platform,
      objective: c.objective,
      status: c.status,
      totals: paidTotals(rows.map((r) => r.metrics)),
      contentIds: raw.campaignContents.filter((cc) => cc.campaign_id === c.id).map((cc) => cc.content_id),
    });
  }
  const byMonth = [...months].sort().map((m) => ({ month: m, label: monthShort(m), totals: paidTotals(metricRows.filter((r) => r.month === m).map((r) => r.metrics)) }));
  return { enabled: true, totals: paidTotals(metricRows.map((r) => r.metrics)), campaigns, byMonth: byMonth.filter((m) => m.totals.investment != null || m.totals.clicks != null) };
}

export function organicVsPaid(contents: ContentResult[], paid: PaidData | null): OrganicPaidRow[] {
  if (!paid) return [];
  const rows: OrganicPaidRow[] = [];
  for (const c of contents) {
    const camps = paid.campaigns.filter((p) => p.contentIds.includes(c.id));
    if (!camps.length) continue;
    const tot = camps.map((p) => p.totals);
    const s = (k: keyof PaidTotals) => sum(tot.map((x) => x[k] as Num));
    const clicks = c.metrics.clicks ?? null;
    const conversions = c.metrics.conversions ?? null;
    rows.push({
      contentId: c.id,
      title: c.title,
      format: c.format,
      thumbPath: c.thumbPath,
      campaigns: camps.map((p) => p.name),
      organic: { reach: c.metrics.reach ?? null, er: c.metrics.engagement_rate ?? null, clicks },
      paid: { reach: s('reach'), impressions: s('impressions'), clicks: s('clicks'), conversions: s('conversions'), investment: s('investment') },
      total: { clicks: sum([clicks, s('clicks')]), conversions: sum([conversions, s('conversions')]) },
    });
  }
  return rows;
}

// ─── funil ──────────────────────────────────────────────────────────────────
export interface FunnelStep {
  label: string;
  value: number;
}
/** Só inclui etapas que têm dado (não inventa etapas vazias). */
export function funnel(profile: ProfileAgg, contents: ContentResult[], paid: PaidData | null): FunnelStep[] {
  const csum = (k: string) => sum(contents.map((c) => mv(c, k)));
  const steps: [string, Num][] = [
    ['Alcance', profile.reach],
    ['Visitas ao perfil', profile.visits],
    ['Cliques', sum([profile.linkClicks, profile.contactClicks])],
    ['Leads', sum([csum('leads'), paid?.totals.leads ?? null])],
    ['Conversões', sum([csum('conversions'), paid?.totals.conversions ?? null])],
  ];
  const out = steps.filter((s): s is [string, number] => s[1] != null && s[1] > 0).map(([label, value]) => ({ label, value }));
  return out.length >= 2 ? out : [];
}

// ─── análises automáticas (só com dados existentes) ─────────────────────────
export interface AutoInsight {
  key: string;
  text: string;
}
const DELTA_METRICS: { k: keyof ProfileAgg; name: string; plural: boolean }[] = [
  { k: 'reach', name: 'O alcance', plural: false },
  { k: 'impressions', name: 'As impressões', plural: true },
  { k: 'interactions', name: 'As interações', plural: true },
  { k: 'shares', name: 'Os compartilhamentos', plural: true },
  { k: 'saves', name: 'Os salvamentos', plural: true },
  { k: 'comments', name: 'Os comentários', plural: true },
  { k: 'likes', name: 'As curtidas', plural: true },
  { k: 'visits', name: 'As visitas ao perfil', plural: true },
  { k: 'linkClicks', name: 'Os cliques no link', plural: true },
];
const lc = (s: string) => s.toLowerCase();
const PLURAL_FORMAT: Record<FormatGroup, string> = { post: 'posts estáticos', carousel: 'carrosséis', reel: 'Reels', story: 'Stories' };

export function autoInsights(p: { cur: ProfileAgg; prev: ProfileAgg; contents: ContentResult[]; formats: FormatStat[]; pillars: PillarStat[]; paid: PaidData | null }): AutoInsight[] {
  const out: AutoInsight[] = [];
  const { cur, prev } = p;
  if (cur.net != null) {
    out.push({ key: 'net_followers', text: cur.net >= 0 ? `O perfil ganhou ${fmtInt(cur.net)} seguidores líquidos no período.` : `O perfil perdeu ${fmtInt(Math.abs(cur.net))} seguidores líquidos no período.` });
  }
  const deltas = DELTA_METRICS.map((m) => ({ m, d: delta(cur[m.k] as Num, prev[m.k] as Num) }))
    .filter((x) => x.d.pct != null && Math.abs(x.d.pct!) >= 10)
    .sort((a, b) => Math.abs(b.d.pct!) - Math.abs(a.d.pct!))
    .slice(0, 3);
  for (const { m, d } of deltas) {
    const up = d.pct! > 0;
    const verb = up ? (m.plural ? 'cresceram' : 'cresceu') : m.plural ? 'caíram' : 'caiu';
    out.push({ key: `delta_${m.k}`, text: `${m.name} ${verb} ${fmtDec(Math.abs(d.pct!))}% em relação ao período anterior.`.replace('.0%', '%') });
  }
  const withReach = p.formats.filter((f) => f.reach != null && f.reach > 0);
  if (withReach.length >= 2) {
    const sorted = [...withReach].sort((a, b) => b.reach! - a.reach!);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const pct = ((best.reach! - worst.reach!) / worst.reach!) * 100;
    if (pct >= 5) out.push({ key: 'format_reach', text: `${best.plural} tiveram alcance médio ${fmtDec(pct).replace(',0', '')}% maior que ${PLURAL_FORMAT[worst.group].replace(/^Reels$/, 'Reels')}.` });
  }
  const bestSaves = [...p.pillars].filter((x) => x.saves != null && x.saves > 0).sort((a, b) => b.saves! - a.saves!)[0];
  if (bestSaves && p.pillars.filter((x) => x.saves != null).length >= 2) out.push({ key: 'pillar_saves', text: `Conteúdos de ${lc(bestSaves.tag)} apresentaram maior número médio de salvamentos (${fmtDec(bestSaves.saves)}).` });
  const topReach = [...p.contents].filter((c) => (c.metrics.reach ?? 0) > 0).sort((a, b) => b.metrics.reach - a.metrics.reach)[0];
  if (topReach) out.push({ key: 'top_reach', text: `“${topReach.title}” teve o maior alcance do período: ${fmtInt(topReach.metrics.reach)} pessoas.` });
  const t = p.paid?.totals;
  if (t && t.investment != null && t.investment > 0) {
    const bits = [`O investimento de ${fmtMoney(t.investment)} em tráfego pago`];
    if (t.leads) bits.push(`gerou ${fmtInt(t.leads)} leads${t.cpl != null ? `, com custo médio de ${fmtMoney(t.cpl)} por lead` : ''}`);
    else if (t.conversions) bits.push(`gerou ${fmtInt(t.conversions)} conversões${t.cpa != null ? `, com custo médio de ${fmtMoney(t.cpa)} por conversão` : ''}`);
    else if (t.clicks) bits.push(`gerou ${fmtInt(t.clicks)} cliques${t.cpc != null ? `, a ${fmtMoney(t.cpc)} por clique` : ''}`);
    else bits.length = 0;
    if (bits.length > 1) out.push({ key: 'paid_summary', text: `${bits.join(' ')}.` });
    if (t.roas != null) out.push({ key: 'paid_roas', text: `O retorno sobre o investimento (ROAS) foi de ${fmtRatio(t.roas)}.` });
  }
  return out;
}

// ─── mês a mês (evolução, melhores meses, dashboard anual) ───────────────────
export interface MonthRow {
  month: string;
  label: string;
  profile: ProfileAgg;
  published: number;
  conversions: Num;
  paidInvestment: Num;
  paidLeads: Num;
  paidConversions: Num;
}
export function monthlyBreakdown(raw: PerfRaw, range: Range): MonthRow[] {
  const out: MonthRow[] = [];
  for (let m = monthStart(range.from); m <= range.to; m = addMonths(m, 1)) {
    const r: Range = { from: m, to: monthEnd(m), label: monthLabel(m) };
    const contents = contentResults(raw, r);
    const paid = paidData(raw, r);
    out.push({
      month: m,
      label: monthShort(m),
      profile: aggregateProfile(raw.profile, r),
      published: contents.length,
      conversions: sum(contents.map((c) => c.metrics.conversions ?? null)),
      paidInvestment: paid?.totals.investment ?? null,
      paidLeads: paid?.totals.leads ?? null,
      paidConversions: paid?.totals.conversions ?? null,
    });
  }
  return out;
}
