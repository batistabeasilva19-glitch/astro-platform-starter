'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ensureProfile, requireUser } from '@/lib/data/clients';
import { removeFiles } from '@/lib/storage';
import { cleanHandle, slugify } from '@/lib/utils';
import { fail, logActivity, type ActionResult } from './shared';

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  company_name: z.string().trim().min(1, 'Informe o nome da empresa.').max(120),
  instagram_handle: z.string().trim().max(60).default(''),
  display_name: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).default(''),
  contact_name: z.string().trim().min(1, 'Informe o nome do responsável.').max(120),
  contact_email: z.string().trim().email('E-mail inválido.').or(z.literal('')).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(3000).default(''),
  avatar_path: z.string().optional(),
});

function parse(fd: FormData) {
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));
  return clientSchema.safeParse(raw);
}

const newToken = () => randomBytes(32).toString('hex');

export async function saveClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const parsed = parse(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const row = {
    company_name: v.company_name,
    instagram_handle: cleanHandle(v.instagram_handle),
    display_name: v.display_name || null,
    bio: v.bio,
    contact_name: v.contact_name,
    contact_email: v.contact_email || null,
    notes: v.notes,
    // o telefone só entra se preenchido (assim tudo funciona mesmo antes da migration 0017)
    ...(v.contact_phone ? { contact_phone: v.contact_phone } : {}),
    ...(v.avatar_path !== undefined ? { avatar_path: v.avatar_path || null } : {}),
  };

  // ── editar ──
  const editingId = String(fd.get('editing') || '');
  if (editingId) {
    const { error } = await supabase.from('clients').update(row).eq('id', editingId);
    if (error) return fail(v.contact_phone ? 'Não foi possível salvar. A migration 0017 (WhatsApp do cliente) foi aplicada no Supabase?' : 'Não foi possível salvar as alterações.');
    if (!v.contact_phone) await supabase.from('clients').update({ contact_phone: null }).eq('id', editingId); // limpar o campo (ignora erro se a coluna ainda não existe)
    revalidatePath('/admin', 'layout');
    const back = String(fd.get('next') || '');
    if (back.startsWith('/admin/identidades')) redirect(back);
    redirect(`/admin/clients/${editingId}`);
  }

  // ── criar ──
  await ensureProfile(user);
  const id = v.id ?? crypto.randomUUID();
  const base = slugify(v.company_name) || 'cliente';
  const { data: taken } = await supabase.from('clients').select('slug').like('slug', `${base}%`);
  const slugs = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; slugs.has(slug); i++) slug = `${base}-${i}`;

  const { error } = await supabase.from('clients').insert({ id, owner_id: user.id, slug, ...row });
  if (error) return fail('Não foi possível criar o cliente.');
  const { error: pErr } = await supabase
    .from('projects')
    .insert({ client_id: id, name: `Projeto ${v.company_name}`, review_token: newToken() });
  if (pErr) return fail('Cliente criado, mas o projeto falhou. Tente editar o cliente.');
  await logActivity(supabase, { clientId: id, actorType: 'admin', action: 'client_created', detail: 'Cliente criado' });

  revalidatePath('/admin', 'layout');
  // vindo do módulo Identidade Visual: volta para lá já com o cliente selecionado
  const next = String(fd.get('next') || '');
  if (next.startsWith('/admin/identidades')) redirect(`${next.split('?')[0]}?client=${id}`);
  redirect(`/admin/clients/${id}`);
}

export async function deleteClient(clientId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: client } = await supabase.from('clients').select('avatar_path').eq('id', clientId).maybeSingle();
  if (!client) return fail('Cliente não encontrado.');
  const { data: media } = await supabase
    .from('content_media')
    .select('storage_path, content_items!inner(client_id)')
    .eq('content_items.client_id', clientId);

  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) return fail('Não foi possível excluir o cliente.');
  await removeFiles([client.avatar_path, ...(media ?? []).map((m) => m.storage_path)].filter(Boolean) as string[]);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

/** Gera um novo link (o anterior deixa de funcionar) e reativa o acesso. */
export async function regenerateLink(clientId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({ review_token: newToken(), token_active: true, token_rotated_at: new Date().toISOString() })
    .eq('client_id', clientId);
  if (error) return fail('Não foi possível gerar um novo link.');
  await logActivity(supabase, { clientId, actorType: 'admin', action: 'link_regenerated', detail: 'Novo link de aprovação gerado' });
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function setLinkActive(clientId: string, active: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('projects').update({ token_active: active }).eq('client_id', clientId);
  if (error) return fail('Não foi possível alterar o link.');
  await logActivity(supabase, {
    clientId,
    actorType: 'admin',
    action: active ? 'link_enabled' : 'link_revoked',
    detail: active ? 'Link de aprovação reativado' : 'Link de aprovação revogado',
  });
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
