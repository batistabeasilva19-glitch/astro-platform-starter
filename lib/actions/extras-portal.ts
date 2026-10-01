'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveToken } from '@/lib/data/portal';
import { fail, logActivity, type ActionResult } from './shared';

/**
 * Ações do CLIENTE (calendário do mês e stories). Toda ação exige o token do link e confere que o item
 * pertence àquele cliente e foi liberado — o cliente nunca consegue mexer em dados de outro.
 */
const done = (token: string) => {
  revalidatePath(`/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
};

async function planOf(db: SupabaseClient, clientId: string, planId: string) {
  const { data } = await db.from('client_plans').select('id, month, status').eq('id', planId).eq('client_id', clientId).eq('visible', true).maybeSingle();
  return data as { id: string; month: string; status: string } | null;
}

/** Recalcula o status do calendário a partir dos itens (todos aprovados → Aprovado; algum com alteração → Alteração solicitada). */
async function recompute(db: SupabaseClient, planId: string, signer: string) {
  const { data: items } = await db.from('client_plan_items').select('client_status').eq('plan_id', planId);
  const list = items ?? [];
  const status = list.length && list.every((i) => i.client_status === 'approved') ? 'approved' : list.some((i) => i.client_status === 'changes_requested') ? 'changes_requested' : 'awaiting';
  await db.from('client_plans').update(status === 'approved' ? { status, approved_at: new Date().toISOString(), approved_by: signer } : { status, approved_at: null, approved_by: null }).eq('id', planId);
  return status;
}

export async function decidePlanItem(token: string, itemId: string, decision: 'approved' | 'changes_requested' | 'pending', note?: string): Promise<ActionResult> {
  const session = await resolveToken(token);
  if (!session) return fail('Este link não está mais ativo. Peça um novo link para a Soltria.');
  const db = createAdminClient();
  const { data: item } = await db.from('client_plan_items').select('id, plan_id, title').eq('id', itemId).maybeSingle();
  if (!item || !(await planOf(db, session.client.id, item.plan_id as string))) return fail('Item não encontrado.');
  const text = (note ?? '').trim().slice(0, 2000);
  if (decision === 'changes_requested' && !text) return fail('Conte para a gente o que gostaria de ajustar.');
  // a consideração do cliente é mantida; só muda se ele escrever uma nova
  const patch: Record<string, unknown> = { client_status: decision, decided_at: decision === 'pending' ? null : new Date().toISOString() };
  if (text) patch.client_note = text;
  const { error } = await db.from('client_plan_items').update(patch).eq('id', itemId);
  if (error) return fail('Não foi possível registrar. Tente novamente.');
  await recompute(db, item.plan_id as string, session.signerName);
  await logActivity(db, { clientId: session.client.id, actorType: 'client', actorName: session.signerName, action: 'plan', detail: decision === 'approved' ? `Aprovou no calendário: ${item.title}` : decision === 'changes_requested' ? `Pediu ajuste no calendário: ${item.title}` : `Desfez a decisão no calendário: ${item.title}` });
  done(token);
  return { ok: true };
}

export async function approveWholePlan(token: string, planId: string): Promise<ActionResult> {
  const session = await resolveToken(token);
  if (!session) return fail('Este link não está mais ativo.');
  const db = createAdminClient();
  const plan = await planOf(db, session.client.id, planId);
  if (!plan) return fail('Calendário não encontrado.');
  const { error } = await db.from('client_plan_items').update({ client_status: 'approved', client_note: '', decided_at: new Date().toISOString() }).eq('plan_id', planId);
  if (error) return fail('Não foi possível registrar a aprovação.');
  await recompute(db, planId, session.signerName);
  await logActivity(db, { clientId: session.client.id, actorType: 'client', actorName: session.signerName, action: 'plan', detail: `Aprovou o calendário de ${plan.month.slice(0, 7)} completo` });
  done(token);
  return { ok: true };
}

export async function setStoryDone(token: string, itemId: string, value: boolean): Promise<ActionResult> {
  const session = await resolveToken(token);
  if (!session) return fail('Este link não está mais ativo. Peça um novo link para a Soltria.');
  const db = createAdminClient();
  const { data: item } = await db.from('client_story_items').select('id, title').eq('id', itemId).eq('client_id', session.client.id).eq('visible', true).maybeSingle();
  if (!item) return fail('Story não encontrado.');
  const { error } = await db.from('client_story_items').update(value ? { done: true, done_at: new Date().toISOString(), done_by: session.signerName } : { done: false, done_at: null, done_by: null }).eq('id', itemId);
  if (error) return fail('Não foi possível registrar. Tente novamente.');
  if (value) await logActivity(db, { clientId: session.client.id, actorType: 'client', actorName: session.signerName, action: 'story', detail: `Postou o story: ${item.title}` });
  done(token);
  return { ok: true };
}

/** Consideração do cliente sobre um item (sem mudar a decisão). Texto vazio apaga a consideração. */
export async function commentPlanItem(token: string, itemId: string, note: string): Promise<ActionResult> {
  const session = await resolveToken(token);
  if (!session) return fail('Este link não está mais ativo. Peça um novo link para a Soltria.');
  const db = createAdminClient();
  const { data: item } = await db.from('client_plan_items').select('id, plan_id, title').eq('id', itemId).maybeSingle();
  if (!item || !(await planOf(db, session.client.id, item.plan_id as string))) return fail('Item não encontrado.');
  const text = note.trim().slice(0, 2000);
  const { error } = await db.from('client_plan_items').update({ client_note: text }).eq('id', itemId);
  if (error) return fail('Não foi possível registrar. Tente novamente.');
  if (text) await logActivity(db, { clientId: session.client.id, actorType: 'client', actorName: session.signerName, action: 'plan', detail: `Comentou no calendário: ${item.title}` });
  done(token);
  return { ok: true };
}
