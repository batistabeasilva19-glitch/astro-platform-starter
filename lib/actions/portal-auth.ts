'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { resolveTokenGate } from '@/lib/data/portal';
import { resolveIdentityGate } from '@/lib/data/identity-portal';
import { endPortalSession, hashPassword, startPortalSession, verifyPassword } from '@/lib/portal-auth';
import { fail, type ActionResult } from './shared';

const MAX_FAILS = 5;
const LOCK_MIN = 15;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAD = 'E-mail ou senha incorretos.';
const MISSING = 'Não foi possível salvar. A migration 0014 foi aplicada no Supabase? (supabase/migrations/0014_login_cliente.sql)';

// ─── Cliente ─────────────────────────────────────────────────────────────

export type PortalKind = 'portal' | 'brand';
const gateFor = (kind: PortalKind, token: string) => (kind === 'brand' ? resolveIdentityGate(token) : resolveTokenGate(token));
const base = (kind: PortalKind, token: string) => (kind === 'brand' ? `/brand/review/${token}` : `/review/${token}`);

export async function portalLogin(kind: PortalKind, token: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const gate = await gateFor(kind, token);
  if (!gate) return fail('Este link não está mais ativo. Peça um novo link para a Soltria.');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return fail('Informe e-mail e senha.');
  const db = createAdminClient();
  const clientId = gate.session.client.id;
  const { data: user } = await db.from('client_portal_users').select('id, email, password_hash, failed_attempts, locked_until').eq('client_id', clientId).ilike('email', email).maybeSingle();
  if (!user) {
    await verifyPassword(password, 'aa:bb'); // custo parecido com o de um e-mail válido
    return fail(BAD);
  }
  if (user.locked_until && new Date(user.locked_until as string) > new Date()) return fail(`Muitas tentativas. Tente novamente em ${LOCK_MIN} minutos.`);
  if (!(await verifyPassword(password, user.password_hash as string))) {
    const fails = (user.failed_attempts as number) + 1;
    await db.from('client_portal_users').update(fails >= MAX_FAILS ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MIN * 60_000).toISOString() } : { failed_attempts: fails }).eq('id', user.id);
    return fail(BAD);
  }
  await db.from('client_portal_users').update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq('id', user.id);
  await startPortalSession(clientId, user.id as string, user.password_hash as string);
  revalidatePath(base(kind, token), 'layout');
  return { ok: true };
}

export async function portalLogout(kind: PortalKind, token: string): Promise<ActionResult> {
  const gate = await gateFor(kind, token);
  if (!gate) return fail('Link indisponível.');
  await endPortalSession(gate.session.client.id);
  revalidatePath(base(kind, token), 'layout');
  return { ok: true };
}

// ─── Administradora ──────────────────────────────────────────────────────

const refresh = () => revalidatePath('/admin', 'layout');
async function ctx() {
  await requireUser();
  return createClient();
}

export async function setLoginRequired(clientId: string, required: boolean): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('clients').update({ portal_login_required: required }).eq('id', clientId);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function addPortalUser(clientId: string, email: string, password: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await ctx();
  const e = email.trim().toLowerCase();
  if (!EMAIL.test(e)) return fail('E-mail inválido.');
  if (password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.');
  const { data, error } = await supabase.from('client_portal_users').insert({ client_id: clientId, email: e, password_hash: await hashPassword(password) }).select('id').single();
  if (error || !data) return fail(error?.code === '23505' ? 'Já existe um acesso com este e-mail.' : MISSING);
  refresh();
  return { ok: true, id: data.id as string };
}

export async function resetPortalPassword(userId: string, password: string): Promise<ActionResult> {
  const supabase = await ctx();
  if (password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.');
  const { error } = await supabase.from('client_portal_users').update({ password_hash: await hashPassword(password), failed_attempts: 0, locked_until: null }).eq('id', userId);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function deletePortalUser(userId: string): Promise<ActionResult> {
  const supabase = await ctx();
  const { error } = await supabase.from('client_portal_users').delete().eq('id', userId);
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
