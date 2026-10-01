import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPaths } from '@/lib/storage';
import { buildReportData, normalizeEdits, publicEdits, type ReportClientInfo, type ReportData } from '@/lib/perf/report';
import type { PerfRaw } from '@/lib/perf/calc';
import type { CampaignContentRow, CampaignMetricRow, CampaignRow, MetaRow, MonthConfigRow, ProfileRow, ReportEdits, SnapshotRow } from '@/lib/perf/types';

/** Carrega tudo do cliente de uma vez (o volume é pequeno) para calcular qualquer período em memória. */
export async function loadPerfRaw(db: SupabaseClient, clientId: string): Promise<{ raw: PerfRaw; missing: boolean }> {
  const empty: PerfRaw = { profile: [], contents: [], meta: [], snapshots: [], campaigns: [], campaignMetrics: [], campaignContents: [], months: [] };
  const [profileRes, contentRes, metaRes, snapRes, campRes, monthRes] = await Promise.all([
    db.from('perf_profile_metrics').select('*').eq('client_id', clientId).order('period_start'),
    db.from('content_items').select('id, title, format, status, scheduled_date, current_version').eq('client_id', clientId),
    db.from('perf_content_meta').select('content_id, tags, objectives').eq('client_id', clientId),
    db.from('perf_content_snapshots').select('*').eq('client_id', clientId).order('collected_on'),
    db.from('perf_campaigns').select('*').eq('client_id', clientId).order('created_at'),
    db.from('perf_months').select('month, uses_paid').eq('client_id', clientId),
  ]);
  if (profileRes.error || metaRes.error || snapRes.error || campRes.error || monthRes.error) return { raw: empty, missing: true };

  const campaigns = (campRes.data ?? []) as CampaignRow[];
  const campIds = campaigns.map((c) => c.id);
  const [cmRes, ccRes] = campIds.length
    ? await Promise.all([db.from('perf_campaign_metrics').select('*').in('campaign_id', campIds), db.from('perf_campaign_contents').select('campaign_id, content_id').in('campaign_id', campIds)])
    : [{ data: [] }, { data: [] }];

  // miniatura (mesma regra dos cartões): Reels/vídeos usam a capa; os demais, a 1ª imagem
  const items = (contentRes.data ?? []) as { id: string; title: string; format: string; status: string; scheduled_date: string | null; current_version: number }[];
  const ids = items.map((i) => i.id);
  const thumbs = new Map<string, string>();
  if (ids.length) {
    const [{ data: versions }, { data: media }] = await Promise.all([
      db.from('content_versions').select('id, content_id, version_number').in('content_id', ids),
      db.from('content_media').select('content_id, version_id, kind, storage_path, position').in('content_id', ids).order('position'),
    ]);
    const cur = new Map<string, string>();
    for (const i of items) {
      const v = (versions ?? []).find((x) => x.content_id === i.id && x.version_number === i.current_version);
      if (v) cur.set(i.id, v.id);
    }
    for (const i of items) {
      const list = (media ?? []).filter((m) => m.content_id === i.id && m.version_id === cur.get(i.id));
      const want = i.format === 'reel' || i.format === 'video' ? 'cover' : 'image';
      const m = list.find((x) => x.kind === want);
      if (m) thumbs.set(i.id, m.storage_path);
    }
  }

  return {
    missing: false,
    raw: {
      profile: (profileRes.data ?? []) as ProfileRow[],
      contents: items.map((i) => ({ id: i.id, title: i.title, format: i.format, status: i.status, scheduled_date: i.scheduled_date, thumb: null, thumbPath: thumbs.get(i.id) ?? null })),
      meta: (metaRes.data ?? []) as MetaRow[],
      snapshots: (snapRes.data ?? []) as SnapshotRow[],
      campaigns,
      campaignMetrics: (cmRes.data ?? []) as CampaignMetricRow[],
      campaignContents: (ccRes.data ?? []) as CampaignContentRow[],
      months: (monthRes.data ?? []) as MonthConfigRow[],
    },
  };
}

/** Nome, logo (avatar) e cores da marca do cliente — as cores vêm da Identidade Visual, se houver. */
export async function loadReportClient(db: SupabaseClient, client: { id: string; company_name: string; instagram_handle: string; avatar_path: string | null }): Promise<ReportClientInfo> {
  let colors: string[] = [];
  try {
    const { data: projects } = await db.from('identity_projects').select('id').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1);
    const pid = projects?.[0]?.id;
    if (pid) {
      const { data: stage } = await db.from('identity_stages').select('id, current_version').eq('project_id', pid).eq('stage_key', 'colors').maybeSingle();
      if (stage) {
        const { data: v } = await db.from('identity_versions').select('content').eq('stage_id', stage.id).eq('version_number', stage.current_version).maybeSingle();
        const content = (v?.content ?? {}) as { palettes?: { colors?: { hex?: string }[] }[]; colors?: { hex?: string }[] };
        const list = content.palettes?.[0]?.colors ?? content.colors ?? [];
        colors = list.map((c) => c.hex ?? '').filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)).slice(0, 4);
      }
    }
  } catch {}
  return { name: client.company_name, handle: client.instagram_handle, logoPath: client.avatar_path, colors };
}

export interface ReportRow {
  id: string;
  client_id: string;
  month: string;
  status: string;
  visible_to_client: boolean;
  edits: unknown;
  frozen: ReportData | null;
  finalized_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface ReportVersionRow {
  id: string;
  report_id: string;
  version_number: number;
  label: string;
  status: string;
  is_final: boolean;
  created_at: string;
}

export async function listReports(db: SupabaseClient, clientId: string): Promise<{ reports: ReportRow[]; missing: boolean }> {
  const { data, error } = await db.from('perf_reports').select('*').eq('client_id', clientId).order('month', { ascending: false });
  if (error) return { reports: [], missing: true };
  return { reports: (data ?? []) as ReportRow[], missing: false };
}

export async function getReport(db: SupabaseClient, clientId: string, month: string) {
  const { data } = await db.from('perf_reports').select('*').eq('client_id', clientId).eq('month', month).maybeSingle();
  if (!data) return null;
  const row = data as ReportRow;
  const { data: versions } = await db.from('perf_report_versions').select('id, report_id, version_number, label, status, is_final, created_at').eq('report_id', row.id).order('version_number', { ascending: false });
  return { row, edits: normalizeEdits(row.edits), versions: (versions ?? []) as ReportVersionRow[] };
}

/** Dados exibidos: o relatório FINALIZADO usa a foto congelada (nunca muda sozinho); os demais, o cálculo ao vivo. */
export async function reportData(db: SupabaseClient, client: { id: string; company_name: string; instagram_handle: string; avatar_path: string | null }, row: ReportRow | null, month: string): Promise<{ data: ReportData; frozen: boolean }> {
  if (row?.frozen && (row.status === 'final' || row.status === 'sent')) return { data: row.frozen, frozen: true };
  const [{ raw }, info] = await Promise.all([loadPerfRaw(db, client.id), loadReportClient(db, client)]);
  return { data: buildReportData(raw, month, info), frozen: false };
}

/** URLs assinadas (miniaturas e logo) para exibir/gerar um relatório. */
export async function signReportAssets(data: ReportData): Promise<{ thumbs: Record<string, string>; logo: string | null }> {
  const paths = [...data.contents.map((c) => c.thumbPath), ...data.organicPaid.map((o) => o.thumbPath), ...data.rankings.flatMap((r) => r.entries.map((e) => e.thumbPath)), data.client.logoPath];
  const signed = await signPaths(paths);
  const thumbs: Record<string, string> = {};
  for (const c of data.contents) if (c.thumbPath && signed[c.thumbPath]) thumbs[c.id] = signed[c.thumbPath];
  return { thumbs, logo: data.client.logoPath ? (signed[data.client.logoPath] ?? null) : null };
}

// ─── portal do cliente: somente o que foi explicitamente liberado ────────────
export interface PublicReportSummary {
  month: string;
  sent_at: string | null;
  finalized_at: string | null;
}
export async function listReleasedReports(db: SupabaseClient, clientId: string): Promise<PublicReportSummary[]> {
  const { data, error } = await db.from('perf_reports').select('month, sent_at, finalized_at').eq('client_id', clientId).eq('visible_to_client', true).in('status', ['final', 'sent']).order('month', { ascending: false });
  if (error) return [];
  return (data ?? []) as PublicReportSummary[];
}

export async function releasedReport(db: SupabaseClient, clientId: string, month: string): Promise<{ data: ReportData; edits: ReportEdits } | null> {
  const { data: row } = await db.from('perf_reports').select('*').eq('client_id', clientId).eq('month', month).eq('visible_to_client', true).in('status', ['final', 'sent']).maybeSingle();
  const r = row as ReportRow | null;
  if (!r?.frozen) return null;
  return { data: r.frozen, edits: publicEdits(normalizeEdits(r.edits)) };
}
