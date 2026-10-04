'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveToken } from '@/lib/data/portal';
import { AWAITING } from '@/lib/constants';
import { getSiteUrl } from '@/lib/site-url';
import { notify } from '@/lib/notifications';
import { REACTION_EMOJIS, cleanReactions, toggleReaction } from '@/lib/reactions';
import { syncTasksForContent } from '@/lib/data/production';
import { fail, logActivity, type ActionResult } from './shared';
import type { ContentItem } from '@/lib/types';

/**
 * Ações do CLIENTE. Toda ação exige o token do link; o servidor valida o token
 * e confere que o conteúdo pertence àquele cliente antes de gravar qualquer coisa.
 */

async function context(token: string, contentId: string) {
  const session = await resolveToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo. Peça um novo link para a Soltria.' } as const;
  const db = createAdminClient();
  const { data } = await db
    .from('content_items')
    .select('*')
    .eq('id', contentId)
    .eq('client_id', session.client.id)
    .maybeSingle();
  if (!data) return { ok: false, error: 'Conteúdo não encontrado.' } as const;
  return { ok: true, session, db, item: data as ContentItem } as const;
}

async function currentVersion(db: SupabaseClient, item: ContentItem) {
  const { data } = await db
    .from('content_versions')
    .select('id, version_number')
    .eq('content_id', item.id)
    .eq('version_number', item.current_version)
    .maybeSingle();
  return data as { id: string; version_number: number } | null;
}

const reviewUrl = async (token: string) => `${await getSiteUrl()}/review/${token}`;

export async function approveContent(
  token: string,
  contentId: string,
  versionId: string,
): Promise<ActionResult> {
  const ctx = await context(token, contentId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, item } = ctx;

  if (!AWAITING.includes(item.status)) return fail('Este conteúdo não está aguardando aprovação.');
  const version = await currentVersion(db, item);
  if (!version || version.id !== versionId) {
    return fail('Existe uma versão mais nova deste conteúdo. Atualize a página para revisar.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('content_items')
    .update({ status: 'approved', approved_at: now, approved_by: session.signerName })
    .eq('id', item.id);
  if (error) return fail('Não foi possível registrar a aprovação. Tente novamente.');

  await db.from('approvals').insert({
    content_id: item.id,
    version_id: version.id,
    action: 'approved',
    client_name: session.signerName,
  });
  await logActivity(db, {
    clientId: session.client.id,
    contentId: item.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'approved',
    detail: `Aprovou a versão ${String(version.version_number).padStart(2, '0')}`,
  });
  await notify({
    db,
    event: 'approved',
    clientId: session.client.id,
    contentId: item.id,
    contentTitle: item.title,
    clientName: session.signerName,
  });
  await syncTasksForContent(db, item.id, 'approved');

  revalidatePath(`/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function requestChanges(
  token: string,
  contentId: string,
  versionId: string,
  message: string,
): Promise<ActionResult> {
  const text = message.trim();
  if (!text) return fail('Conte para a gente o que você gostaria de alterar.');
  if (text.length > 3000) return fail('O texto está muito longo (máx. 3000 caracteres).');

  const ctx = await context(token, contentId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, item } = ctx;

  if (!AWAITING.includes(item.status)) return fail('Este conteúdo não está aguardando aprovação.');
  const version = await currentVersion(db, item);
  if (!version || version.id !== versionId) {
    return fail('Existe uma versão mais nova deste conteúdo. Atualize a página para revisar.');
  }

  const { error } = await db
    .from('content_items')
    .update({ status: 'changes_requested', approved_at: null, approved_by: null })
    .eq('id', item.id);
  if (error) return fail('Não foi possível enviar a solicitação. Tente novamente.');

  await db.from('comments').insert({
    content_id: item.id,
    version_id: version.id,
    author_type: 'client',
    author_name: session.signerName,
    message: text,
    is_change_request: true,
  });
  await db.from('approvals').insert({
    content_id: item.id,
    version_id: version.id,
    action: 'changes_requested',
    client_name: session.signerName,
    note: text,
  });
  await logActivity(db, {
    clientId: session.client.id,
    contentId: item.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'changes_requested',
    detail: 'Solicitou alteração',
  });
  await notify({
    db,
    event: 'changes_requested',
    clientId: session.client.id,
    contentId: item.id,
    contentTitle: item.title,
    clientName: session.signerName,
    message: text,
  });
  await syncTasksForContent(db, item.id, 'changes');

  revalidatePath(`/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function addClientComment(
  token: string,
  contentId: string,
  message: string,
  slideIndex?: number | null,
  replyTo?: string | null,
): Promise<ActionResult> {
  const text = message.trim();
  if (!text) return fail('Escreva uma mensagem antes de enviar.');
  if (text.length > 3000) return fail('O texto está muito longo (máx. 3000 caracteres).');

  const ctx = await context(token, contentId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, item } = ctx;
  const version = await currentVersion(db, item);
  if (replyTo) {
    const { data: parent } = await db.from('comments').select('id').eq('id', replyTo).eq('content_id', item.id).maybeSingle();
    if (!parent) replyTo = null;
  }

  await db.from('comments').insert({
    content_id: item.id,
    version_id: version?.id ?? null,
    author_type: 'client',
    author_name: session.signerName,
    message: text,
    slide_index: slideIndex && slideIndex > 0 ? slideIndex : null,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  await logActivity(db, {
    clientId: session.client.id,
    contentId: item.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'comment',
    detail: slideIndex ? `Comentou no slide ${slideIndex}` : 'Deixou um comentário',
  });

  revalidatePath(`/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function approveAll(token: string): Promise<ActionResult<{ count: number }>> {
  const session = await resolveToken(token);
  if (!session) return fail('Este link não está mais ativo.');
  const db = createAdminClient();

  const { data: items } = await db
    .from('content_items')
    .select('*')
    .eq('client_id', session.client.id)
    .in('status', AWAITING);
  const list = (items ?? []) as ContentItem[];
  if (!list.length) return fail('Não há conteúdos aguardando aprovação.');

  const now = new Date().toISOString();
  let count = 0;
  for (const item of list) {
    const version = await currentVersion(db, item);
    const { error } = await db
      .from('content_items')
      .update({ status: 'approved', approved_at: now, approved_by: session.signerName })
      .eq('id', item.id)
      .in('status', AWAITING);
    if (error) continue;
    count++;
    await db.from('approvals').insert({
      content_id: item.id,
      version_id: version?.id ?? null,
      action: 'approved',
      client_name: session.signerName,
      note: 'Aprovação em lote',
    });
    await logActivity(db, {
      clientId: session.client.id,
      contentId: item.id,
      actorType: 'client',
      actorName: session.signerName,
      action: 'approved',
      detail: 'Aprovou (aprovação em lote)',
    });
    await notify({
      db,
      event: 'approved',
      clientId: session.client.id,
      contentId: item.id,
      contentTitle: item.title,
      clientName: session.signerName,
      reviewUrl: await reviewUrl(token),
    });
    await syncTasksForContent(db, item.id, 'approved');
  }

  revalidatePath(`/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
  return { ok: true, count };
}

/** O cliente reage com emoji a um comentário. */
export async function reactClientComment(token: string, contentId: string, commentId: string, emoji: string): Promise<ActionResult> {
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) return fail('Emoji inválido.');
  const ctx = await context(token, contentId);
  if (!ctx.ok) return fail(ctx.error);
  const { db, item } = ctx;
  const { data: c } = await db.from('comments').select('id, reactions').eq('id', commentId).eq('content_id', item.id).maybeSingle();
  if (!c) return fail('Comentário não encontrado.');
  const { error } = await db.from('comments').update({ reactions: toggleReaction(cleanReactions(c.reactions), emoji, 'client') }).eq('id', commentId);
  if (error) return fail('Não foi possível reagir agora.');
  revalidatePath(`/review/${token}`, 'layout');
  return { ok: true };
}
