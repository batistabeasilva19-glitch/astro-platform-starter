'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { removeFiles } from '@/lib/storage';
import { fail, type ActionResult } from './shared';

/** Atualiza o nome e/ou a foto da administradora (a foto é enviada antes, direto ao Storage). */
export async function updateProfile(input: { name: string; avatarPath?: string | null }): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) return fail('Escreva o seu nome.');
  if (name.length > 80) return fail('O nome está muito longo (máx. 80 caracteres).');

  const { error } = await supabase.from('users').upsert({ id: user.id, email: user.email, name }, { onConflict: 'id' });
  if (error) return fail('Não foi possível salvar o nome.');

  if (input.avatarPath !== undefined) {
    if (input.avatarPath && !input.avatarPath.startsWith(`${user.id}/`)) return fail('Caminho de foto inválido.');
    const { data: before } = await supabase.from('users').select('avatar_path').eq('id', user.id).maybeSingle();
    const { error: aErr } = await supabase.from('users').update({ avatar_path: input.avatarPath }).eq('id', user.id);
    if (aErr) return fail('Nome salvo, mas a foto precisa da migration 0004 no Supabase (supabase/migrations/0004_perfil.sql).');
    if (before?.avatar_path && before.avatar_path !== input.avatarPath) await removeFiles([before.avatar_path]);
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
