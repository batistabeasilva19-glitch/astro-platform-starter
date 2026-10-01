'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { isIsoDate } from '@/lib/perf/validate';
import { PLAN_FORMATS } from '@/lib/extras/types';
import { fail, logActivity, type ActionResult } from './shared';

const MISSING = 'Não foi possível salvar. A migration 0012 foi aplicada no Supabase? (supabase/migrations/0012_portal_roteiros_calendario_stories.sql)';
const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/review', 'layout');
};
const trim = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const FORMAT_IDS: string[] = PLAN_FORMATS.map((f) => f.id);
type Supa = Awaited<ReturnType<typeof createClient>>;
const ctx = async () => {
  await requireUser();
  return createClient();
};
const contentOk = async (supabase: Supa, clientId: string, id?: string | null) => {
  if (!id) return true;
  const { data } = await supabase.from('content_items').select('id').eq('id', id).eq('client_id', clientId).maybeSingle();
  return !!data;
};

/** Troca a posição com o vizinho (ordem 1, 2, 3…). `scope` = filtro do grupo. */
async function swap(supabase: Supa, table: string, id: string, dir: -1 | 1, scope: Record<string, string>): Promise<ActionResult> {
  let q = supabase.from(table).select('id, position').order('position').order('created_at');
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  const { data } = await q;
  const order = (data ?? []).map((r) => r.id as string);
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return { ok: true };
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((rid, pos) => supabase.from(table).update({ position: pos }).eq('id', rid)));
  refresh();
  return { ok: true };
}
const nextPos = async (supabase: Supa, table: string, scope: Record<string, string>) => {
  let q = supabase.from(table).select('position').order('position', { ascending: false }).limit(1);
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  const { data } = await q;
  return ((data?.[0]?.position as number | undefined) ?? -1) + 1;
};

// ─── roteiros de gravação ────────────────────────────────────────────
export async function saveScript(input: { id?: string; clientId: string; month: string; title: string; script: string; notes?: string; shoot_date?: string; visible?: boolean }): Promise<ActionResult> {
  const supabase = await ctx();
  if (!MONTH.test(input.month)) return fail('Escolha o mês.');
  const title = trim(input.title, 200);
  if (!title) return fail('Dê um título ao vídeo.');
  if (input.shoot_date && !isIsoDate(input.shoot_date)) return fail('Data de gravação inválida.');
  const row = { client_id: input.clientId, month: `${input.month}-01`, title, script: trim(input.script, 20000), notes: trim(input.notes, 2000), shoot_date: input.shoot_date || null, visible: input.visible !== false };
  const { error } = input.id ? await supabase.from('client_scripts').update(row).eq('id', input.id).eq('client_id', input.clientId) : await supabase.from('client_scripts').insert({ ...row, position: await nextPos(supabase, 'client_scripts', { client_id: input.clientId, month: row.month }) });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
export async function deleteScript(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_scripts').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}
export async function moveScript(id: string, dir: -1 | 1): Promise<ActionResult> {
  const supabase = await ctx();
  const { data: s } = await supabase.from('client_scripts').select('client_id, month').eq('id', id).maybeSingle();
  if (!s) return fail('Roteiro não encontrado.');
  return swap(supabase, 'client_scripts', id, dir, { client_id: s.client_id as string, month: s.month as string });
}
export async function setScriptVisible(id: string, visible: boolean): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_scripts').update({ visible }).eq('id', id);
  if (error) return fail('Não foi possível atualizar.');
  refresh();
  return { ok: true };
}

// ─── calendário do mês (aprovação) ───────────────────────────────────
export async function createPlan(clientId: string, month: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await ctx();
  if (!MONTH.test(month)) return fail('Escolha o mês.');
  const m = `${month}-01`;
  const { data: ex } = await supabase.from('client_plans').select('id').eq('client_id', clientId).eq('month', m).maybeSingle();
  if (ex) return { ok: true, id: ex.id as string };
  const { data, error } = await supabase.from('client_plans').insert({ client_id: clientId, month: m }).select('id').single();
  if (error || !data) return fail(MISSING);
  refresh();
  return { ok: true, id: data.id };
}
export async function updatePlan(id: string, patch: { note?: string }): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_plans').update({ note: trim(patch.note, 2000) }).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}
export async function deletePlan(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_plans').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

/** Itens em ordem (posts, carrosséis, Reels…). Editar um item já decidido o devolve para “Aguardando”. */
export async function savePlanItem(input: { id?: string; planId: string; format: string; title: string; publish_date?: string; description?: string; content_id?: string | null }): Promise<ActionResult> {
  const supabase = await ctx();
  const title = trim(input.title, 200);
  if (!title) return fail('Dê um título ao item.');
  if (!FORMAT_IDS.includes(input.format)) return fail('Escolha o formato.');
  if (input.publish_date && !isIsoDate(input.publish_date)) return fail('Data inválida.');
  const { data: plan } = await supabase.from('client_plans').select('id, client_id, status, visible').eq('id', input.planId).maybeSingle();
  if (!plan) return fail('Calendário não encontrado.');
  if (!(await contentOk(supabase, plan.client_id as string, input.content_id))) return fail('Conteúdo não encontrado.');
  const row = { format: input.format, title, publish_date: input.publish_date || null, description: trim(input.description, 4000), content_id: input.content_id || null };
  let reopen = false;
  if (input.id) {
    const { data: cur } = await supabase.from('client_plan_items').select('*').eq('id', input.id).maybeSingle();
    const changed = !!cur && (cur.format !== row.format || cur.title !== row.title || cur.publish_date !== row.publish_date || cur.description !== row.description || cur.content_id !== row.content_id);
    const { error } = await supabase.from('client_plan_items').update({ ...row, ...(changed && cur?.client_status !== 'pending' ? { client_status: 'pending', decided_at: null } : {}) }).eq('id', input.id).eq('plan_id', input.planId);
    if (error) return fail(MISSING);
    reopen = changed && cur?.client_status !== 'pending';
  } else {
    const { error } = await supabase.from('client_plan_items').insert({ ...row, plan_id: input.planId, position: await nextPos(supabase, 'client_plan_items', { plan_id: input.planId }) });
    if (error) return fail(MISSING);
    reopen = plan.status === 'approved' && !!plan.visible;
  }
  if (reopen && plan.visible) await supabase.from('client_plans').update({ status: 'awaiting', approved_at: null, approved_by: null }).eq('id', input.planId);
  refresh();
  return { ok: true };
}
export async function deletePlanItem(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_plan_items').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}
export async function movePlanItem(id: string, dir: -1 | 1): Promise<ActionResult> {
  const supabase = await ctx();
  const { data: it } = await supabase.from('client_plan_items').select('plan_id').eq('id', id).maybeSingle();
  if (!it) return fail('Item não encontrado.');
  return swap(supabase, 'client_plan_items', id, dir, { plan_id: it.plan_id as string });
}
/** Envia para o cliente aprovar (ele passa a ver o calendário no link dele). */
export async function sendPlan(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { data: plan } = await supabase.from('client_plans').select('id, client_id, month').eq('id', id).maybeSingle();
  if (!plan) return fail('Calendário não encontrado.');
  const { count } = await supabase.from('client_plan_items').select('id', { count: 'exact', head: true }).eq('plan_id', id);
  if (!count) return fail('Adicione pelo menos um item antes de enviar.');
  const { data: items } = await supabase.from('client_plan_items').select('client_status').eq('plan_id', id);
  const all = (items ?? []).every((i) => i.client_status === 'approved');
  const { error } = await supabase.from('client_plans').update({ visible: true, status: all ? 'approved' : 'awaiting', sent_at: new Date().toISOString(), ...(all ? {} : { approved_at: null, approved_by: null }) }).eq('id', id);
  if (error) return fail('Não foi possível enviar.');
  await logActivity(supabase, { clientId: plan.client_id as string, actorType: 'admin', action: 'plan', detail: `Calendário de ${String(plan.month).slice(0, 7)} enviado para aprovação` });
  refresh();
  return { ok: true };
}
export async function unsendPlan(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_plans').update({ visible: false, status: 'draft' }).eq('id', id);
  if (error) return fail('Não foi possível atualizar.');
  refresh();
  return { ok: true };
}
export async function resetPlanItem(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { data: it } = await supabase.from('client_plan_items').select('plan_id').eq('id', id).maybeSingle();
  if (!it) return fail('Item não encontrado.');
  await supabase.from('client_plan_items').update({ client_status: 'pending', decided_at: null }).eq('id', id);
  await supabase.from('client_plans').update({ status: 'awaiting', approved_at: null, approved_by: null }).eq('id', it.plan_id).eq('visible', true);
  refresh();
  return { ok: true };
}

// ─── stories do dia ──────────────────────────────────────────────────
export async function saveStory(input: { id?: string; clientId: string; story_date: string; title: string; description?: string; link?: string; content_id?: string | null; visible?: boolean }): Promise<ActionResult> {
  const supabase = await ctx();
  if (!isIsoDate(input.story_date)) return fail('Escolha o dia.');
  const title = trim(input.title, 200);
  if (!title) return fail('Dê um título ao story.');
  const link = trim(input.link, 500);
  if (link && !/^https?:\/\/\S+$/i.test(link)) return fail('O link precisa começar com https://');
  if (!(await contentOk(supabase, input.clientId, input.content_id))) return fail('Conteúdo não encontrado.');
  const row = { client_id: input.clientId, story_date: input.story_date, title, description: trim(input.description, 3000), link, content_id: input.content_id || null, visible: input.visible !== false };
  const { error } = input.id ? await supabase.from('client_story_items').update(row).eq('id', input.id).eq('client_id', input.clientId) : await supabase.from('client_story_items').insert({ ...row, position: await nextPos(supabase, 'client_story_items', { client_id: input.clientId, story_date: input.story_date }) });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
/** Uma linha por story: cria vários de uma vez, já na ordem 1, 2, 3… */
export async function addStories(clientId: string, storyDate: string, lines: string[]): Promise<ActionResult<{ added: number }>> {
  const supabase = await ctx();
  if (!isIsoDate(storyDate)) return fail('Escolha o dia.');
  const titles = lines.map((l) => trim(l, 200)).filter(Boolean).slice(0, 50);
  if (!titles.length) return fail('Escreva pelo menos um story (um por linha).');
  let pos = await nextPos(supabase, 'client_story_items', { client_id: clientId, story_date: storyDate });
  const { error } = await supabase.from('client_story_items').insert(titles.map((title) => ({ client_id: clientId, story_date: storyDate, title, position: pos++ })));
  if (error) return fail(MISSING);
  refresh();
  return { ok: true, added: titles.length };
}
export async function deleteStory(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_story_items').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}
export async function moveStory(id: string, dir: -1 | 1): Promise<ActionResult> {
  const supabase = await ctx();
  const { data: s } = await supabase.from('client_story_items').select('client_id, story_date').eq('id', id).maybeSingle();
  if (!s) return fail('Story não encontrado.');
  return swap(supabase, 'client_story_items', id, dir, { client_id: s.client_id as string, story_date: s.story_date as string });
}
export async function resetStory(id: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_story_items').update({ done: false, done_at: null, done_by: null }).eq('id', id);
  if (error) return fail('Não foi possível atualizar.');
  refresh();
  return { ok: true };
}
