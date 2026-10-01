'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { getClient } from '@/lib/data/clients';
import { getReport, loadPerfRaw, loadReportClient, reportData } from '@/lib/data/perf';
import { daysBetween, monthStart, todayBR } from '@/lib/perf/calc';
import { buildReportData, mergeInsights, normalizeEdits, type ReportData } from '@/lib/perf/report';
import { CONTENT_FIELDS, EMPTY_EDITS, PAID_DECIMAL, PAID_FIELDS, PROFILE_FIELDS, isSource, toFormatGroup, type Insight, type ReportEdits, type SnapshotLabel } from '@/lib/perf/types';
import { isIsoDate, parseMetrics } from '@/lib/perf/validate';
import { fail, logActivity, type ActionResult } from './shared';

const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/review', 'layout');
};
const MISSING = 'Não foi possível salvar. A migration 0008 foi aplicada no Supabase? (supabase/migrations/0008_desempenho.sql)';
const dbFail = (error: { code?: string; message?: string }, dup?: string) => (error.code === '23505' && dup ? fail(dup) : fail(MISSING));
const trimStr = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const src = (v: unknown) => (isSource(v) ? v : 'manual');

// ─── perfil ───────────────────────────────────────────────────────────────

export async function saveProfileMetrics(clientId: string, input: { id?: string; period_start: string; period_end: string; source: string; source_note?: string; notes?: string; values: Record<string, unknown> }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (!isIsoDate(input.period_start) || !isIsoDate(input.period_end)) return fail('Informe a data inicial e a data final.');
  if (input.period_end < input.period_start) return fail('A data final não pode ser anterior à data inicial.');
  if (input.period_end > todayBR()) return fail('A data final não pode estar no futuro.');
  if (daysBetween(input.period_start, input.period_end) > 366) return fail('O período não pode passar de 1 ano.');
  const parsed = parseMetrics(input.values, PROFILE_FIELDS.flatMap((g) => g.fields));
  if (!parsed.ok) return fail(parsed.error);
  const v = parsed.values;
  if (!Object.keys(v).length) return fail('Preencha pelo menos uma métrica.');

  // evita dobrar números: períodos do mesmo cliente não podem se sobrepor
  const { data: others, error: e0 } = await supabase.from('perf_profile_metrics').select('id, period_start, period_end').eq('client_id', clientId).lte('period_start', input.period_end).gte('period_end', input.period_start);
  if (e0) return fail(MISSING);
  const clash = (others ?? []).find((o) => o.id !== input.id);
  if (clash) return fail(`Já existe um registro de ${clash.period_start.split('-').reverse().join('/')} a ${clash.period_end.split('-').reverse().join('/')} que se sobrepõe a este período. Edite o existente ou ajuste as datas.`);

  const row = { client_id: clientId, period_start: input.period_start, period_end: input.period_end, source: src(input.source), source_note: trimStr(input.source_note, 300), notes: trimStr(input.notes, 2000), ...Object.fromEntries(PROFILE_FIELDS.flatMap((g) => g.fields).map((f) => [f.key, v[f.key] ?? null])) };
  const { error } = input.id ? await supabase.from('perf_profile_metrics').update(row).eq('id', input.id).eq('client_id', clientId) : await supabase.from('perf_profile_metrics').insert(row);
  if (error) return dbFail(error, 'Já existe um registro para exatamente este período.');
  refresh();
  return { ok: true };
}

export async function deleteProfileMetrics(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('perf_profile_metrics').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

export async function setMonthPaid(clientId: string, month: string, uses: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (!isIsoDate(month)) return fail('Mês inválido.');
  const { error } = await supabase.from('perf_months').upsert({ client_id: clientId, month: monthStart(month), uses_paid: uses }, { onConflict: 'client_id,month' });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

// ─── conteúdos ────────────────────────────────────────────────────────────

async function contentOf(contentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('content_items').select('id, client_id, format, scheduled_date, title').eq('id', contentId).maybeSingle();
  return { supabase, content: data as { id: string; client_id: string; format: string; scheduled_date: string | null; title: string } | null };
}

const cleanTags = (list: unknown, max = 12) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of Array.isArray(list) ? list : []) {
    const s = trimStr(t, 30);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, max);
};

export async function saveContentMeta(contentId: string, input: { tags: string[]; objectives: string[] }): Promise<ActionResult> {
  await requireUser();
  const { supabase, content } = await contentOf(contentId);
  if (!content) return fail('Conteúdo não encontrado.');
  const { error } = await supabase.from('perf_content_meta').upsert({ content_id: contentId, client_id: content.client_id, tags: cleanTags(input.tags), objectives: cleanTags(input.objectives, 9) }, { onConflict: 'content_id' });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function saveSnapshot(contentId: string, input: { id?: string; collected_on: string; label: SnapshotLabel; values: Record<string, unknown>; source: string; source_note?: string; notes?: string; is_final?: boolean }): Promise<ActionResult> {
  await requireUser();
  const { supabase, content } = await contentOf(contentId);
  if (!content) return fail('Conteúdo não encontrado.');
  if (!isIsoDate(input.collected_on)) return fail('Informe a data da coleta.');
  if (input.collected_on > todayBR()) return fail('A data da coleta não pode estar no futuro.');
  if (content.scheduled_date && input.collected_on < content.scheduled_date) return fail('A data da coleta não pode ser anterior à data de publicação do conteúdo.');
  const label = (['24h', '7d', '30d', 'custom'] as const).includes(input.label) ? input.label : 'custom';
  const parsed = parseMetrics(input.values, CONTENT_FIELDS[toFormatGroup(content.format)]);
  if (!parsed.ok) return fail(parsed.error);
  if (!Object.keys(parsed.values).length) return fail('Preencha pelo menos uma métrica.');
  const m = parsed.values;
  if (m.interactions != null && m.reach != null && m.interactions > m.reach * 20) return fail('As interações totais parecem altas demais para o alcance informado. Confira os números.');

  const row = { content_id: contentId, client_id: content.client_id, collected_on: input.collected_on, label, metrics: m, source: src(input.source), source_note: trimStr(input.source_note, 300), notes: trimStr(input.notes, 2000), is_final: !!input.is_final };
  if (row.is_final) await supabase.from('perf_content_snapshots').update({ is_final: false }).eq('content_id', contentId).eq('is_final', true);
  const { error } = input.id ? await supabase.from('perf_content_snapshots').update(row).eq('id', input.id).eq('content_id', contentId) : await supabase.from('perf_content_snapshots').insert(row);
  if (error) return dbFail(error, 'Já existe uma coleta desta publicação nesta data com o mesmo rótulo. Edite a existente ou escolha outra data.');
  await logActivity(supabase, { clientId: content.client_id, contentId, actorType: 'admin', action: 'performance', detail: `Desempenho registrado (${label})` });
  refresh();
  return { ok: true };
}

export async function setFinalSnapshot(snapshotId: string, final: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: s } = await supabase.from('perf_content_snapshots').select('id, content_id').eq('id', snapshotId).maybeSingle();
  if (!s) return fail('Coleta não encontrada.');
  if (final) await supabase.from('perf_content_snapshots').update({ is_final: false }).eq('content_id', s.content_id).eq('is_final', true);
  const { error } = await supabase.from('perf_content_snapshots').update({ is_final: final }).eq('id', snapshotId);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function deleteSnapshot(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('perf_content_snapshots').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

// ─── tráfego pago ─────────────────────────────────────────────────────────

export async function saveCampaign(clientId: string, input: { id?: string; name: string; platform: string; objective?: string; start_date?: string; end_date?: string; budget?: string; spent?: string; status: string; notes?: string }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const name = trimStr(input.name, 160);
  if (!name) return fail('Dê um nome à campanha.');
  const start = input.start_date && isIsoDate(input.start_date) ? input.start_date : null;
  const end = input.end_date && isIsoDate(input.end_date) ? input.end_date : null;
  if (start && end && end < start) return fail('A data final da campanha não pode ser anterior à inicial.');
  const money = parseMetrics({ budget: input.budget, spent: input.spent }, [
    { key: 'budget', label: 'Orçamento', unit: 'int' },
    { key: 'spent', label: 'Valor gasto', unit: 'int' },
  ], { decimals: new Set([...PAID_DECIMAL, 'budget', 'spent']) });
  if (!money.ok) return fail(money.error);
  const row = {
    client_id: clientId,
    name,
    platform: ['meta', 'google', 'other'].includes(input.platform) ? input.platform : 'meta',
    objective: trimStr(input.objective, 160),
    start_date: start,
    end_date: end,
    budget: money.values.budget ?? null,
    spent: money.values.spent ?? null,
    status: ['planned', 'active', 'paused', 'finished'].includes(input.status) ? input.status : 'active',
    notes: trimStr(input.notes, 2000),
  };
  const { error } = input.id ? await supabase.from('perf_campaigns').update(row).eq('id', input.id).eq('client_id', clientId) : await supabase.from('perf_campaigns').insert(row);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('perf_campaigns').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

export async function saveCampaignMetrics(campaignId: string, input: { month: string; values: Record<string, unknown>; source: string; notes?: string }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (!isIsoDate(input.month)) return fail('Escolha o mês.');
  const month = monthStart(input.month);
  if (month > todayBR()) return fail('O mês não pode estar no futuro.');
  const parsed = parseMetrics(input.values, PAID_FIELDS, { decimals: PAID_DECIMAL });
  if (!parsed.ok) return fail(parsed.error);
  if (!Object.keys(parsed.values).length) return fail('Preencha pelo menos uma métrica.');
  const v = parsed.values;
  if (v.clicks != null && v.impressions != null && v.clicks > v.impressions) return fail('Os cliques não podem ser maiores que as impressões.');
  const { error } = await supabase.from('perf_campaign_metrics').upsert({ campaign_id: campaignId, month, metrics: v, source: src(input.source), notes: trimStr(input.notes, 2000) }, { onConflict: 'campaign_id,month' });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function deleteCampaignMetrics(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('perf_campaign_metrics').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

/** Criativos do anúncio: quais conteúdos do sistema fazem parte da campanha. */
export async function setCampaignContents(campaignId: string, contentIds: string[]): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: camp } = await supabase.from('perf_campaigns').select('id, client_id').eq('id', campaignId).maybeSingle();
  if (!camp) return fail('Campanha não encontrada.');
  const ids = [...new Set(contentIds)].slice(0, 100);
  if (ids.length) {
    const { data: ok } = await supabase.from('content_items').select('id').eq('client_id', camp.client_id).in('id', ids);
    if ((ok ?? []).length !== ids.length) return fail('Algum conteúdo não pertence a este cliente.');
  }
  await supabase.from('perf_campaign_contents').delete().eq('campaign_id', campaignId);
  if (ids.length) {
    const { error } = await supabase.from('perf_campaign_contents').insert(ids.map((content_id) => ({ campaign_id: campaignId, content_id })));
    if (error) return fail(MISSING);
  }
  refresh();
  return { ok: true };
}

// ─── relatórios mensais ───────────────────────────────────────────────────

const clientForReport = async (clientId: string) => getClient(clientId);

/** Cria o relatório do mês (rascunho) já com as análises automáticas. Se já existir, só devolve o mês. */
export async function createReport(clientId: string, month: string): Promise<ActionResult<{ month: string }>> {
  await requireUser();
  const supabase = await createClient();
  if (!isIsoDate(month)) return fail('Escolha o mês do relatório.');
  const m = monthStart(month);
  const client = await clientForReport(clientId);
  if (!client) return fail('Cliente não encontrado.');
  const existing = await getReport(supabase, clientId, m);
  if (existing) return { ok: true, month: m };
  const [{ raw, missing }, info] = await Promise.all([loadPerfRaw(supabase, clientId), loadReportClient(supabase, client)]);
  if (missing) return fail(MISSING);
  const data = buildReportData(raw, m, info);
  const edits: ReportEdits = { ...EMPTY_EDITS, insights: mergeInsights([], data.autoInsights) };
  const { data: row, error } = await supabase.from('perf_reports').insert({ client_id: clientId, month: m, status: 'draft', edits }).select('id').single();
  if (error || !row) return fail(MISSING);
  await supabase.from('perf_report_versions').insert({ report_id: row.id, version_number: 1, label: 'Versão 1', status: 'draft', edits, data });
  await logActivity(supabase, { clientId, actorType: 'admin', action: 'report', detail: `Relatório de ${m.slice(0, 7)} criado` });
  refresh();
  return { ok: true, month: m };
}

async function openReport(reportId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('perf_reports').select('*').eq('id', reportId).maybeSingle();
  return { supabase, row: data as { id: string; client_id: string; month: string; status: string; visible_to_client: boolean; edits: unknown; frozen: ReportData | null } | null };
}

const sanitizeInsights = (list: unknown): Insight[] =>
  (Array.isArray(list) ? list : []).slice(0, 40).map((i, n) => {
    const x = i as Partial<Insight>;
    return { id: trimStr(x.id, 60) || `m-${n}`, key: trimStr(x.key, 60), text: trimStr(x.text, 600), enabled: x.enabled !== false, edited: !!x.edited };
  }).filter((i) => i.text);

/** Salva textos, análises, títulos e observações. Relatório finalizado não aceita edição (reabra antes). */
export async function saveReportEdits(reportId: string, input: ReportEdits): Promise<ActionResult> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  if (row.status === 'final' || row.status === 'sent') return fail('Este relatório está finalizado. Reabra o relatório para editar.');
  const clip = (o: Record<string, string> | undefined, max: number) => Object.fromEntries(Object.entries(o ?? {}).slice(0, 60).map(([k, v]) => [k.slice(0, 40), trimStr(v, max)]));
  const edits: ReportEdits = { texts: clip(input.texts, 4000), analyses: clip(input.analyses, 2000), titles: clip(input.titles, 80), insights: sanitizeInsights(input.insights), internal_notes: trimStr(input.internal_notes, 4000) };
  const { error } = await supabase.from('perf_reports').update({ edits }).eq('id', reportId);
  if (error) return fail('Não foi possível salvar o relatório.');
  refresh();
  return { ok: true };
}

/** Traz os números mais recentes do mês para o rascunho (mantém tudo que a administradora escreveu). */
export async function refreshReportData(reportId: string): Promise<ActionResult<{ added: number }>> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  if (row.status === 'final' || row.status === 'sent') return fail('Este relatório está finalizado. Reabra o relatório para atualizar os dados.');
  const client = await clientForReport(row.client_id);
  if (!client) return fail('Cliente não encontrado.');
  const [{ raw }, info] = await Promise.all([loadPerfRaw(supabase, row.client_id), loadReportClient(supabase, client)]);
  const data = buildReportData(raw, row.month, info);
  const edits = normalizeEdits(row.edits);
  const before = edits.insights.length;
  edits.insights = mergeInsights(edits.insights, data.autoInsights);
  const { error } = await supabase.from('perf_reports').update({ edits }).eq('id', reportId);
  if (error) return fail('Não foi possível atualizar.');
  refresh();
  return { ok: true, added: Math.max(0, edits.insights.length - before) };
}

/** Guarda uma versão do relatório (Versão 1, 2, 3…) — nada se perde. */
export async function saveReportVersion(reportId: string, label?: string): Promise<ActionResult<{ version: number }>> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  const client = await clientForReport(row.client_id);
  if (!client) return fail('Cliente não encontrado.');
  const { data } = await reportData(supabase, client, row as never, row.month);
  const { data: last } = await supabase.from('perf_report_versions').select('version_number').eq('report_id', reportId).order('version_number', { ascending: false }).limit(1).maybeSingle();
  const n = (last?.version_number ?? 0) + 1;
  const { error } = await supabase.from('perf_report_versions').insert({ report_id: reportId, version_number: n, label: trimStr(label, 60) || `Versão ${n}`, status: row.status, edits: normalizeEdits(row.edits), data, is_final: false });
  if (error) return fail('Não foi possível salvar a versão.');
  refresh();
  return { ok: true, version: n };
}

/** Restaura os textos de uma versão antiga como rascunho atual (a versão antiga continua guardada). */
export async function restoreReportVersion(reportId: string, versionId: string): Promise<ActionResult> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  if (row.status === 'final' || row.status === 'sent') return fail('Reabra o relatório antes de restaurar uma versão.');
  const { data: v } = await supabase.from('perf_report_versions').select('edits').eq('id', versionId).eq('report_id', reportId).maybeSingle();
  if (!v) return fail('Versão não encontrada.');
  const { error } = await supabase.from('perf_reports').update({ edits: normalizeEdits(v.edits) }).eq('id', reportId);
  if (error) return fail('Não foi possível restaurar.');
  refresh();
  return { ok: true };
}

/** Status do rascunho: Rascunho → Em análise → Pronto para revisão. (Finalizar e liberar têm ações próprias.) */
export async function setReportStatus(reportId: string, status: string): Promise<ActionResult> {
  await requireUser();
  if (!['draft', 'in_review', 'ready'].includes(status)) return fail('Status inválido.');
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  if (row.status === 'final' || row.status === 'sent') return fail('Reabra o relatório para mudar o status.');
  const { error } = await supabase.from('perf_reports').update({ status }).eq('id', reportId);
  if (error) return fail('Não foi possível atualizar o status.');
  refresh();
  return { ok: true };
}

/** FINALIZAR: congela uma foto dos dados. Depois disso, mudar métricas ou posts não altera este relatório. */
export async function finalizeReport(reportId: string): Promise<ActionResult> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  if (row.status === 'final' || row.status === 'sent') return { ok: true };
  const client = await clientForReport(row.client_id);
  if (!client) return fail('Cliente não encontrado.');
  const [{ raw }, info] = await Promise.all([loadPerfRaw(supabase, row.client_id), loadReportClient(supabase, client)]);
  const data = buildReportData(raw, row.month, info);
  const edits = normalizeEdits(row.edits);
  const now = new Date().toISOString();
  const { error } = await supabase.from('perf_reports').update({ status: 'final', frozen: data, finalized_at: now }).eq('id', reportId);
  if (error) return fail('Não foi possível finalizar o relatório.');
  const { data: last } = await supabase.from('perf_report_versions').select('version_number').eq('report_id', reportId).order('version_number', { ascending: false }).limit(1).maybeSingle();
  await supabase.from('perf_report_versions').insert({ report_id: reportId, version_number: (last?.version_number ?? 0) + 1, label: 'FINAL', status: 'final', edits, data, is_final: true });
  await logActivity(supabase, { clientId: row.client_id, actorType: 'admin', action: 'report', detail: `Relatório de ${row.month.slice(0, 7)} finalizado` });
  refresh();
  return { ok: true };
}

/** Reabrir: libera a edição (some do portal do cliente até ser finalizado e liberado de novo). */
export async function reopenReport(reportId: string): Promise<ActionResult> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  const { error } = await supabase.from('perf_reports').update({ status: 'in_review', frozen: null, finalized_at: null, visible_to_client: false, sent_at: null }).eq('id', reportId);
  if (error) return fail('Não foi possível reabrir.');
  refresh();
  return { ok: true };
}

/** "Disponibilizar para cliente": só relatórios finalizados. Liga → “Enviado ao cliente”. */
export async function setReportVisible(reportId: string, visible: boolean): Promise<ActionResult> {
  await requireUser();
  const { supabase, row } = await openReport(reportId);
  if (!row) return fail('Relatório não encontrado.');
  if (row.status !== 'final' && row.status !== 'sent') return fail('Finalize o relatório antes de disponibilizá-lo ao cliente.');
  const { error } = await supabase.from('perf_reports').update(visible ? { visible_to_client: true, status: 'sent', sent_at: new Date().toISOString() } : { visible_to_client: false, status: 'final' }).eq('id', reportId);
  if (error) return fail('Não foi possível atualizar.');
  await logActivity(supabase, { clientId: row.client_id, actorType: 'admin', action: 'report', detail: visible ? `Relatório de ${row.month.slice(0, 7)} disponibilizado ao cliente` : `Relatório de ${row.month.slice(0, 7)} ocultado do cliente` });
  refresh();
  return { ok: true };
}

export async function deleteReport(reportId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('perf_reports').delete().eq('id', reportId);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

