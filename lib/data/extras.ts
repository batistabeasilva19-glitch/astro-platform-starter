import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCards } from '@/lib/data/content';
import type { EventRow, PlanItemRow, PlanRow, ScriptRow, StoryRow } from '@/lib/extras/types';

/** Miniaturas (arte já cadastrada) dos conteúdos citados — só para quem foi vinculado de propósito. */
async function thumbsFor(db: SupabaseClient, clientId: string, ids: (string | null)[]): Promise<Record<string, string>> {
  const wanted = new Set(ids.filter((x): x is string => !!x));
  if (!wanted.size) return {};
  const cards = await fetchCards(db, { clientId });
  const out: Record<string, string> = {};
  for (const c of cards) if (wanted.has(c.id) && c.thumb) out[c.id] = c.thumb;
  return out;
}

// ─── administradora ──────────────────────────────────────────────────
export async function adminScripts(db: SupabaseClient, clientId: string): Promise<{ rows: ScriptRow[]; missing: boolean }> {
  const { data, error } = await db.from('client_scripts').select('*').eq('client_id', clientId).order('month', { ascending: false }).order('position');
  return error ? { rows: [], missing: true } : { rows: (data ?? []) as ScriptRow[], missing: false };
}
export async function adminPlans(db: SupabaseClient, clientId: string): Promise<{ plans: (PlanRow & { items: PlanItemRow[] })[]; missing: boolean; thumbs: Record<string, string> }> {
  const { data, error } = await db.from('client_plans').select('*').eq('client_id', clientId).order('month', { ascending: false });
  if (error) return { plans: [], missing: true, thumbs: {} };
  const ids = (data ?? []).map((p) => p.id as string);
  const { data: items } = ids.length ? await db.from('client_plan_items').select('*').in('plan_id', ids).order('position') : { data: [] };
  const list = (items ?? []) as PlanItemRow[];
  return { plans: ((data ?? []) as PlanRow[]).map((p) => ({ ...p, items: list.filter((i) => i.plan_id === p.id) })), missing: false, thumbs: await thumbsFor(db, clientId, list.map((i) => i.content_id)) };
}
export async function adminStories(db: SupabaseClient, clientId: string): Promise<{ rows: StoryRow[]; missing: boolean }> {
  const { data, error } = await db.from('client_story_items').select('*').eq('client_id', clientId).order('story_date', { ascending: false }).order('position');
  return error ? { rows: [], missing: true } : { rows: (data ?? []) as StoryRow[], missing: false };
}
export async function adminEvents(db: SupabaseClient, clientId: string): Promise<{ rows: EventRow[]; missing: boolean }> {
  const { data, error } = await db.from('client_events').select('*').eq('client_id', clientId).order('event_date').order('start_time');
  return error ? { rows: [], missing: true } : { rows: (data ?? []) as EventRow[], missing: false };
}
export async function contentOptions(db: SupabaseClient, clientId: string, format?: string[]) {
  let q = db.from('content_items').select('id, title, format, scheduled_date').eq('client_id', clientId).order('scheduled_date', { ascending: false, nullsFirst: false }).limit(200);
  if (format) q = q.in('format', format);
  const { data } = await q;
  return (data ?? []).map((c) => ({ id: c.id as string, title: c.title as string, format: c.format as string, date: (c.scheduled_date as string | null) ?? null }));
}

// ─── portal do cliente (somente o que foi liberado) ──────────────────
export async function portalScripts(db: SupabaseClient, clientId: string): Promise<ScriptRow[]> {
  const { data, error } = await db.from('client_scripts').select('*').eq('client_id', clientId).eq('visible', true).order('month', { ascending: false }).order('position');
  return error ? [] : ((data ?? []) as ScriptRow[]);
}
export async function portalPlans(db: SupabaseClient, clientId: string): Promise<{ plans: (PlanRow & { items: PlanItemRow[] })[]; thumbs: Record<string, string> }> {
  const { data, error } = await db.from('client_plans').select('*').eq('client_id', clientId).eq('visible', true).order('month', { ascending: false });
  if (error || !data?.length) return { plans: [], thumbs: {} };
  const { data: items } = await db.from('client_plan_items').select('*').in('plan_id', data.map((p) => p.id as string)).order('position');
  const list = (items ?? []) as PlanItemRow[];
  return { plans: (data as PlanRow[]).map((p) => ({ ...p, items: list.filter((i) => i.plan_id === p.id) })), thumbs: await thumbsFor(db, clientId, list.map((i) => i.content_id)) };
}
export async function portalStories(db: SupabaseClient, clientId: string): Promise<{ rows: StoryRow[]; thumbs: Record<string, string> }> {
  const { data, error } = await db.from('client_story_items').select('*').eq('client_id', clientId).eq('visible', true).order('story_date').order('position');
  if (error) return { rows: [], thumbs: {} };
  const rows = (data ?? []) as StoryRow[];
  return { rows, thumbs: await thumbsFor(db, clientId, rows.map((r) => r.content_id)) };
}
export async function portalEvents(db: SupabaseClient, clientId: string): Promise<EventRow[]> {
  const { data, error } = await db.from('client_events').select('*').eq('client_id', clientId).eq('visible', true).order('event_date').order('start_time');
  return error ? [] : ((data ?? []) as EventRow[]);
}
export async function portalCounts(db: SupabaseClient, clientId: string) {
  const [s, p, st, ev] = await Promise.all([
    db.from('client_scripts').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('visible', true),
    db.from('client_plans').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('visible', true),
    db.from('client_story_items').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('visible', true),
    db.from('client_events').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('visible', true).neq('status', 'cancelled'),
  ]);
  return { scripts: s.error ? 0 : (s.count ?? 0), plans: p.error ? 0 : (p.count ?? 0), stories: st.error ? 0 : (st.count ?? 0), events: ev.error ? 0 : (ev.count ?? 0) };
}
