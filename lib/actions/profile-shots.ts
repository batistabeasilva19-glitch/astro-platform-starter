'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { removeFiles } from '@/lib/storage';
import { fail, type ActionResult } from './shared';

const MISSING = 'Não foi possível salvar. A migration 0009 foi aplicada no Supabase? (supabase/migrations/0009_perfil_antes.sql)';
const refresh = () => revalidatePath('/admin', 'layout');
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Registra um print já enviado ao Storage (envio direto do navegador). Só administradora. */
export async function addProfileShot(input: { clientId: string; path: string; caption?: string; takenOn?: string }): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!input.path.startsWith(`${user.id}/${input.clientId}/profile-before/`)) return fail('Caminho de arquivo inválido.');
  const { data: client } = await supabase.from('clients').select('id').eq('id', input.clientId).maybeSingle();
  if (!client) return fail('Cliente não encontrado.');
  const { error } = await supabase.from('client_profile_shots').insert({ client_id: input.clientId, kind: 'before', storage_path: input.path, caption: (input.caption ?? '').trim().slice(0, 300), taken_on: isDate(input.takenOn) ? input.takenOn : null });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function updateProfileShot(id: string, patch: { caption?: string; takenOn?: string }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const row: Record<string, unknown> = {};
  if (patch.caption !== undefined) row.caption = patch.caption.trim().slice(0, 300);
  if (patch.takenOn !== undefined) row.taken_on = isDate(patch.takenOn) ? patch.takenOn : null;
  const { error } = await supabase.from('client_profile_shots').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}

export async function deleteProfileShot(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: shot } = await supabase.from('client_profile_shots').select('storage_path').eq('id', id).maybeSingle();
  if (!shot) return fail('Print não encontrado.');
  const { error } = await supabase.from('client_profile_shots').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  await removeFiles([shot.storage_path]);
  refresh();
  return { ok: true };
}
