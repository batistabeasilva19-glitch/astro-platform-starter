'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { removeFiles } from '@/lib/storage';
import { notify } from '@/lib/notifications';
import { REACTION_EMOJIS, cleanReactions, toggleReaction } from '@/lib/reactions';
import { FORMATS, STATUSES } from '@/lib/constants';
import { getSiteUrl } from '@/lib/site-url';
import type { ContentFormat, ContentItem, ContentStatus, MediaKind } from '@/lib/types';
import { autoCreateTaskForContent, syncTasksForContent } from '@/lib/data/production';
import { fail, logActivity, type ActionResult } from './shared';

const contentSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().trim().min(1, 'Dê um título interno ao conteúdo.').max(160),
  format: z.enum(FORMATS as [ContentFormat, ...ContentFormat[]]),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal('')).optional(),
  objective: z.string().trim().max(600).default(''),
  caption: z.string().max(5000).default(''),
  cta: z.string().trim().max(300).default(''),
  hashtags: z.string().trim().max(1000).default(''),
  internal_notes: z.string().trim().max(3000).default(''),
  status: z.enum(STATUSES as [ContentStatus, ...ContentStatus[]]).default('draft'),
  duration_seconds: z.string().optional(),
});

const refresh = () => revalidatePath('/admin', 'layout');

async function owned(contentId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('content_items').select('*').eq('id', contentId).maybeSingle();
  return { supabase, item: (data as ContentItem | null) ?? null };
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseForm(fd: FormData) {
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));
  return contentSchema.safeParse(raw);
}

export async function createContent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const parsed = parseForm(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const { data: project } = await supabase.from('projects').select('id').eq('client_id', v.client_id).maybeSingle();
  if (!project) return fail('Projeto do cliente não encontrado.');

  const { data: item, error } = await supabase
    .from('content_items')
    .insert({
      client_id: v.client_id,
      project_id: project.id,
      title: v.title,
      format: v.format,
      scheduled_date: v.scheduled_date || null,
      scheduled_time: v.scheduled_time || null,
      objective: v.objective,
      internal_notes: v.internal_notes,
      status: v.status === 'pending_approval' || v.status === 'revised_pending' ? 'draft' : v.status,
    })
    .select('id')
    .single();
  if (error || !item) return fail('Não foi possível criar o conteúdo.');

  const { error: vErr } = await supabase.from('content_versions').insert({
    content_id: item.id,
    version_number: 1,
    caption: v.caption,
    cta: v.cta,
    hashtags: v.hashtags,
    duration_seconds: v.duration_seconds ? Number(v.duration_seconds) || null : null,
  });
  if (vErr) return fail('Conteúdo criado, mas a versão 01 falhou.');

  await logActivity(supabase, {
    clientId: v.client_id,
    contentId: item.id,
    actorType: 'admin',
    action: 'created',
    detail: 'Conteúdo criado',
  });
  await autoCreateTaskForContent(supabase, { id: item.id, client_id: v.client_id, title: v.title, format: v.format, scheduled_date: v.scheduled_date || null });
  refresh();
  redirect(`/admin/content/${item.id}?novo=1`);
}

export async function updateContent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = String(fd.get('id') || '');
  const { supabase, item } = await owned(id);
  if (!item) return fail('Conteúdo não encontrado.');
  const parsed = parseForm(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const { error } = await supabase
    .from('content_items')
    .update({
      title: v.title,
      format: v.format,
      scheduled_date: v.scheduled_date || null,
      scheduled_time: v.scheduled_time || null,
      objective: v.objective,
      internal_notes: v.internal_notes,
    })
    .eq('id', id);
  if (error) return fail('Não foi possível salvar.');

  const { error: vErr } = await supabase
    .from('content_versions')
    .update({
      caption: v.caption,
      cta: v.cta,
      hashtags: v.hashtags,
      duration_seconds: v.duration_seconds ? Number(v.duration_seconds) || null : null,
    })
    .eq('content_id', id)
    .eq('version_number', item.current_version);
  if (vErr) return fail('Não foi possível salvar a legenda.');

  if (v.status !== item.status) {
    const res = await changeStatus(id, v.status);
    if (!res.ok) return res;
  }
  refresh();
  return { ok: true };
}

export async function deleteContent(contentId: string): Promise<ActionResult> {
  const { supabase, item } = await owned(contentId);
  if (!item) return fail('Conteúdo não encontrado.');
  const { data: media } = await supabase.from('content_media').select('storage_path').eq('content_id', contentId);
  const { error } = await supabase.from('content_items').delete().eq('id', contentId);
  if (error) return fail('Não foi possível excluir.');
  await removeFiles((media ?? []).map((m) => m.storage_path));
  refresh();
  return { ok: true };
}

/** Envia para aprovação (v01 → "Aguardando"; v02+ → "Alterado — aguardando nova aprovação"). */
export async function sendForApproval(contentId: string): Promise<ActionResult> {
  const { supabase, item } = await owned(contentId);
  if (!item) return fail('Conteúdo não encontrado.');

  const { data: version } = await supabase
    .from('content_versions')
    .select('id, version_number')
    .eq('content_id', contentId)
    .eq('version_number', item.current_version)
    .single();
  const { data: media } = await supabase
    .from('content_media')
    .select('kind')
    .eq('version_id', version!.id);
  const hasArt = (media ?? []).some((m) => m.kind === 'image' || m.kind === 'cover');
  if (!hasArt) {
    return fail(
      `"${item.title}": suba a ${item.format === 'reel' || item.format === 'video' ? 'capa e o vídeo' : 'arte'} antes de enviar.`,
    );
  }

  const status: ContentStatus = version!.version_number > 1 ? 'revised_pending' : 'pending_approval';
  const { error } = await supabase
    .from('content_items')
    .update({ status, sent_at: new Date().toISOString(), approved_at: null, approved_by: null })
    .eq('id', contentId);
  if (error) return fail('Não foi possível enviar para aprovação.');

  await logActivity(supabase, {
    clientId: item.client_id,
    contentId,
    actorType: 'admin',
    action: 'sent',
    detail: `Enviado para aprovação (versão ${pad(version!.version_number)})`,
  });

  const { data: client } = await supabase.from('clients').select('company_name, contact_email').eq('id', item.client_id).single();
  const { data: project } = await supabase.from('projects').select('review_token').eq('client_id', item.client_id).single();
  await notify({
    db: supabase,
    event: 'awaiting_approval',
    clientId: item.client_id,
    contentId,
    contentTitle: item.title,
    clientName: client?.company_name ?? '',
    clientEmail: client?.contact_email,
    reviewUrl: project ? `${await getSiteUrl()}/review/${project.review_token}` : undefined,
  });
  await syncTasksForContent(supabase, contentId, 'awaiting_client');
  refresh();
  return { ok: true };
}

/** Envia todos os rascunhos de um cliente. */
export async function sendAllDrafts(clientId: string): Promise<ActionResult<{ sent: number; skipped: string[] }>> {
  await requireUser();
  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from('content_items')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'draft');
  let sent = 0;
  const skipped: string[] = [];
  for (const d of drafts ?? []) {
    const r = await sendForApproval(d.id);
    if (r.ok) sent++;
    else skipped.push(r.error);
  }
  if (!sent && !skipped.length) return fail('Não há rascunhos para enviar.');
  return { ok: true, sent, skipped };
}

/** Troca manual de status (Programado, Publicado, Rascunho...). */
export async function changeStatus(contentId: string, status: ContentStatus): Promise<ActionResult> {
  if (status === 'pending_approval' || status === 'revised_pending') return sendForApproval(contentId);
  const { supabase, item } = await owned(contentId);
  if (!item) return fail('Conteúdo não encontrado.');
  const patch: Record<string, unknown> = { status };
  if (status !== 'approved') Object.assign(patch, { approved_at: null, approved_by: null });
  const { error } = await supabase.from('content_items').update(patch).eq('id', contentId);
  if (error) return fail('Não foi possível alterar o status.');
  await logActivity(supabase, {
    clientId: item.client_id,
    contentId,
    actorType: 'admin',
    action: 'status',
    detail: `Status alterado para ${status}`,
  });
  const kind = ({ approved: 'approved', scheduled: 'scheduled', published: 'published', changes_requested: 'changes' } as const)[status as 'approved'];
  if (kind) await syncTasksForContent(supabase, contentId, kind);
  refresh();
  return { ok: true };
}

/** Cria Versão N+1 copiando legenda e mídias; as versões anteriores ficam preservadas. */
export async function createNewVersion(contentId: string, note: string): Promise<ActionResult> {
  const { supabase, item } = await owned(contentId);
  if (!item) return fail('Conteúdo não encontrado.');

  const { data: cur } = await supabase
    .from('content_versions')
    .select('*')
    .eq('content_id', contentId)
    .eq('version_number', item.current_version)
    .single();
  if (!cur) return fail('Versão atual não encontrada.');
  const next = item.current_version + 1;

  const { data: nv, error } = await supabase
    .from('content_versions')
    .insert({
      content_id: contentId,
      version_number: next,
      caption: cur.caption,
      cta: cur.cta,
      hashtags: cur.hashtags,
      duration_seconds: cur.duration_seconds,
      note: note.trim(),
    })
    .select('id')
    .single();
  if (error || !nv) return fail('Não foi possível criar a nova versão.');

  const { data: media } = await supabase.from('content_media').select('*').eq('version_id', cur.id);
  if (media?.length) {
    await supabase.from('content_media').insert(
      media.map((m) => ({
        content_id: contentId,
        version_id: nv.id,
        kind: m.kind,
        storage_path: m.storage_path, // mesmo arquivo; só é apagado quando nenhuma versão o usa
        position: m.position,
        mime_type: m.mime_type,
      })),
    );
  }
  await supabase.from('content_items').update({ current_version: next }).eq('id', contentId);
  await logActivity(supabase, {
    clientId: item.client_id,
    contentId,
    actorType: 'admin',
    action: 'new_version',
    detail: `Nova versão adicionada (versão ${pad(next)})`,
  });
  refresh();
  return { ok: true };
}

// ─── Mídias ───────────────────────────────────────────────────────────────
async function dropMediaRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { id: string; storage_path: string }[],
) {
  for (const row of rows) {
    await supabase.from('content_media').delete().eq('id', row.id);
    const { count } = await supabase
      .from('content_media')
      .select('id', { count: 'exact', head: true })
      .eq('storage_path', row.storage_path);
    if (!count) await removeFiles([row.storage_path]); // nenhuma outra versão usa o arquivo
  }
}

export async function registerMedia(input: {
  contentId: string;
  versionId: string;
  kind: MediaKind;
  path: string;
  mime: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const { supabase, item } = await owned(input.contentId);
  if (!item) return fail('Conteúdo não encontrado.');
  if (!input.path.startsWith(`${user.id}/`)) return fail('Caminho de arquivo inválido.');

  const { data: version } = await supabase
    .from('content_versions')
    .select('id, version_number')
    .eq('id', input.versionId)
    .eq('content_id', input.contentId)
    .maybeSingle();
  if (!version) return fail('Versão não encontrada.');
  if (version.version_number !== item.current_version) return fail('Só é possível editar a versão atual.');

  const { data: existing } = await supabase
    .from('content_media')
    .select('id, kind, storage_path, position')
    .eq('version_id', input.versionId);

  // vídeo e capa são únicos; post tem só uma arte
  const single = input.kind === 'video' || input.kind === 'cover' || (input.kind === 'image' && item.format === 'post');
  if (single) {
    await dropMediaRows(supabase, (existing ?? []).filter((m) => m.kind === input.kind));
  }
  const position = single ? 0 : Math.max(-1, ...(existing ?? []).filter((m) => m.kind === 'image').map((m) => m.position)) + 1;

  const { error } = await supabase.from('content_media').insert({
    content_id: input.contentId,
    version_id: input.versionId,
    kind: input.kind,
    storage_path: input.path,
    position,
    mime_type: input.mime,
  });
  if (error) return fail('Arquivo enviado, mas não foi possível registrá-lo.');
  refresh();
  return { ok: true };
}

export async function removeMedia(mediaId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: m } = await supabase.from('content_media').select('id, storage_path').eq('id', mediaId).maybeSingle();
  if (!m) return fail('Arquivo não encontrado.');
  await dropMediaRows(supabase, [m]);
  refresh();
  return { ok: true };
}

export async function reorderMedia(versionId: string, orderedIds: string[]): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, i) => supabase.from('content_media').update({ position: i }).eq('id', id).eq('version_id', versionId)),
  );
  refresh();
  return { ok: true };
}

export async function setDuration(contentId: string, seconds: number): Promise<ActionResult> {
  const { supabase, item } = await owned(contentId);
  if (!item) return fail('Conteúdo não encontrado.');
  await supabase
    .from('content_versions')
    .update({ duration_seconds: Math.round(seconds) })
    .eq('content_id', contentId)
    .eq('version_number', item.current_version);
  refresh();
  return { ok: true };
}

// ─── Comentários da administradora ────────────────────────────────────────
export async function addAdminComment(
  contentId: string,
  message: string,
  slideIndex?: number | null,
  replyTo?: string | null,
): Promise<ActionResult> {
  const user = await requireUser();
  const { supabase, item } = await owned(contentId);
  if (!item) return fail('Conteúdo não encontrado.');
  const text = message.trim();
  if (!text) return fail('Escreva uma mensagem.');
  if (replyTo) {
    const { data: parent } = await supabase.from('comments').select('id').eq('id', replyTo).eq('content_id', contentId).maybeSingle();
    if (!parent) replyTo = null;
  }
  const { data: prof } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
  const { data: version } = await supabase
    .from('content_versions')
    .select('id')
    .eq('content_id', contentId)
    .eq('version_number', item.current_version)
    .maybeSingle();
  const { error } = await supabase.from('comments').insert({
    content_id: contentId,
    version_id: version?.id ?? null,
    author_type: 'admin',
    author_name: prof?.name || 'Soltria',
    message: text,
    slide_index: slideIndex ?? null,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  if (error) return fail(replyTo ? 'Não foi possível responder. A migration 0018 foi aplicada no Supabase?' : 'Não foi possível enviar o comentário.');
  await logActivity(supabase, {
    clientId: item.client_id,
    contentId,
    actorType: 'admin',
    actorName: prof?.name || 'Soltria',
    action: 'comment',
    detail: 'Respondeu no chat do conteúdo',
  });
  refresh();
  return { ok: true };
}

// ─── Feed ─────────────────────────────────────────────────────────────────
export async function saveFeedLayout(clientId: string, order: string[]): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('feed_layouts')
    .upsert({ client_id: clientId, item_order: order, updated_at: new Date().toISOString() }, { onConflict: 'client_id' });
  if (error) return fail('Não foi possível salvar a organização do feed.');
  await logActivity(supabase, { clientId, actorType: 'admin', action: 'feed_saved', detail: 'Organização do feed salva' });
  refresh();
  revalidatePath('/review', 'layout');
  return { ok: true };
}


/** A administradora reage com emoji a um comentário (o cliente vê que ela leu). */
export async function reactAdminComment(commentId: string, emoji: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) return fail('Emoji inválido.');
  const { data: c, error: e1 } = await supabase.from('comments').select('id, reactions').eq('id', commentId).maybeSingle();
  if (e1 || !c) return fail(e1 ? 'Não foi possível reagir. A migration 0018 foi aplicada no Supabase?' : 'Comentário não encontrado.');
  const { error } = await supabase.from('comments').update({ reactions: toggleReaction(cleanReactions(c.reactions), emoji, 'admin') }).eq('id', commentId);
  if (error) return fail('Não foi possível reagir. A migration 0018 foi aplicada no Supabase?');
  refresh();
  return { ok: true };
}
