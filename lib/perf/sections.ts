import type { ReportData } from './report';
import { REPORT_SECTIONS, type ReportEdits } from './types';

const filled = (s: string | undefined) => !!s?.trim();

/** Quais seções entram no relatório (preview e PDF usam a mesma regra): sem dado → a seção não aparece. */
export function visibleSections(data: ReportData, edits: ReportEdits) {
  const p = data.profile;
  const t = edits.texts;
  const has: Record<string, boolean> = {
    overview: true,
    growth: p.series.followers.length > 0 || p.cur.net != null,
    reach: p.series.reach.length > 0 || p.series.impressions.length > 0 || p.cur.reach != null || p.cur.impressions != null,
    engagement: p.cur.interactions != null || p.series.interactions.length > 0,
    published: data.published.total > 0,
    highlights: data.rankings.length > 0,
    formats: data.formats.length > 0,
    pillars: data.pillars.length > 0,
    paid: !!data.paid,
    organic_paid: data.organicPaid.length > 0,
    learnings: filled(t.learnings) || filled(t.worked) || filled(t.improve),
    recommendations: filled(t.recommendations),
    next: ['next_goals', 'next_tests', 'next_pillars', 'next_formats', 'next_steps'].some((k) => filled(t[k])),
  };
  return REPORT_SECTIONS.filter((s) => has[s.id]).map((s, i) => ({ ...s, number: String(i + 1).padStart(2, '0'), title: edits.titles[s.id]?.trim() || s.title }));
}
