'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/data/clients';
import { resolveToken } from '@/lib/data/portal';
import { missingRequired, sanitizeAnswers } from '@/lib/social-form/questions';
import { fail, logActivity, type ActionResult } from './shared';

const MISSING = 'Não foi possível salvar. A migration 0016 foi aplicada no Supabase? (supabase/migrations/0016_formulario_social.sql)';
const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/review', 'layout');
};
async function ctx() {
  await requireUser();
  return createClient();
}

// ─── administradora ──────────────────────────────────────────────────
/** Envia o formulário ao cliente (ele passa a ver no link dele). */
export async function sendSocialForm(clientId: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { data: cur } = await supabase.from('client_social_forms').select('id').eq('client_id', clientId).maybeSingle();
  if (cur) return { ok: true };
  const { error } = await supabase.from('client_social_forms').insert({ client_id: clientId });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
/** Libera a edição: o formulário volta a ficar aberto para o cliente. */
export async function releaseSocialForm(clientId: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_social_forms').update({ status: 'open', submitted_at: null, submitted_by: null }).eq('client_id', clientId);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
/** Trava manualmente (marca como respondido). */
export async function lockSocialForm(clientId: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_social_forms').update({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: 'Soltria (marcado manualmente)' }).eq('client_id', clientId);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
/** Remove o formulário (e as respostas) — some do link do cliente. */
export async function deleteSocialForm(clientId: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_social_forms').delete().eq('client_id', clientId);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

// ─── cliente (só pelo token do link) ─────────────────────────────────
async function portalCtx(token: string) {
  const session = await resolveToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo. Peça um novo link para a Soltria.' } as const;
  const db = createAdminClient();
  const { data } = await db.from('client_social_forms').select('id, status').eq('client_id', session.client.id).maybeSingle();
  if (!data) return { ok: false, error: 'O formulário ainda não está disponível.' } as const;
  return { ok: true, session, db, form: data as { id: string; status: string } } as const;
}

export async function saveSocialAnswers(token: string, answers: unknown): Promise<ActionResult> {
  const c = await portalCtx(token);
  if (!c.ok) return fail(c.error);
  if (c.form.status !== 'open') return fail('O formulário já foi enviado e está travado. Fale com a Soltria para liberar a edição.');
  const { error } = await c.db.from('client_social_forms').update({ answers: sanitizeAnswers(answers) }).eq('id', c.form.id);
  return error ? fail('Não foi possível salvar. Tente novamente.') : { ok: true };
}

export async function submitSocialForm(token: string, answers: unknown): Promise<ActionResult> {
  const c = await portalCtx(token);
  if (!c.ok) return fail(c.error);
  if (c.form.status !== 'open') return fail('O formulário já foi enviado e está travado.');
  const clean = sanitizeAnswers(answers);
  const missing = missingRequired(clean);
  if (missing.length) return fail(`Faltam respostas obrigatórias: ${missing.map((q) => q.label.replace(/\?$/, '')).join('; ')}.`);
  const { error } = await c.db.from('client_social_forms').update({ answers: clean, status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: c.session.signerName }).eq('id', c.form.id);
  if (error) return fail('Não foi possível enviar. Tente novamente.');
  await logActivity(c.db, { clientId: c.session.client.id, actorType: 'client', actorName: c.session.signerName, action: 'comment', detail: 'Formulário de perfil respondido' });
  refresh();
  return { ok: true };
}
