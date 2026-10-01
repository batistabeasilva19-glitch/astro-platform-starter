'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { removeFiles } from '@/lib/storage';
import { toMonthDate } from '@/lib/strategy';
import { fail, logActivity, type ActionResult } from './shared';

const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/review', 'layout');
};
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Registra um PDF já enviado ao Storage (o envio é feito direto do navegador). */
export async function registerStrategyDoc(input: { clientId: string; month: string; title: string; description?: string; path: string; fileName: string; size: number }): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!MONTH_RE.test(input.month)) return fail('Escolha um mês válido.');
  if (!input.path.startsWith(`${user.id}/`)) return fail('Caminho de arquivo inválido.');
  const { data: client } = await supabase.from('clients').select('id').eq('id', input.clientId).maybeSingle();
  if (!client) return fail('Cliente não encontrado.');
  const title = input.title.trim() || input.fileName.replace(/\.pdf$/i, '');
  const { error } = await supabase.from('strategy_documents').insert({
    client_id: input.clientId,
    month: toMonthDate(input.month),
    title: title.slice(0, 160),
    description: (input.description ?? '').trim().slice(0, 1000),
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    size_bytes: input.size,
  });
  if (error) return fail('Arquivo enviado, mas não foi possível registrá-lo. A migration 0006 foi aplicada no Supabase? (supabase/migrations/0006_estrategia.sql)');
  await logActivity(supabase, { clientId: input.clientId, actorType: 'admin', action: 'strategy', detail: `Estratégia “${title}” adicionada` });
  refresh();
  return { ok: true };
}

export async function updateStrategyDoc(id: string, patch: { title?: string; description?: string; month?: string; visible?: boolean }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) return fail('Dê um título ao documento.');
    row.title = patch.title.trim().slice(0, 160);
  }
  if (patch.description !== undefined) row.description = patch.description.trim().slice(0, 1000);
  if (patch.month !== undefined) {
    if (!MONTH_RE.test(patch.month)) return fail('Mês inválido.');
    row.month = toMonthDate(patch.month);
  }
  if (patch.visible !== undefined) row.visible = patch.visible;
  const { error } = await supabase.from('strategy_documents').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}

export async function deleteStrategyDoc(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: doc } = await supabase.from('strategy_documents').select('storage_path').eq('id', id).maybeSingle();
  if (!doc) return fail('Documento não encontrado.');
  const { error } = await supabase.from('strategy_documents').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  await removeFiles([doc.storage_path]);
  refresh();
  return { ok: true };
}
