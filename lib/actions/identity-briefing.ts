'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveIdentityToken } from '@/lib/data/identity-portal';
import { logIdentity, syncProjectStatus } from '@/lib/data/identity';
import { removeFiles } from '@/lib/storage';
import { MEDIA_BUCKET } from '@/lib/constants';
import { missingRequired, sanitizeAnswers } from '@/lib/identity/briefing';
import type { IdentityStage } from '@/lib/identity/types';
import { fail, type ActionResult } from './shared';

/**
 * FORMULÁRIO DA MARCA — ações do CLIENTE (sem login, só pelo token do link).
 * O cliente só mexe nas respostas e nas fotos de referência do próprio projeto.
 */
const MAX_REFERENCES = 30;
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

async function ctx(token: string) {
  const session = await resolveIdentityToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo. Peça um novo link para a Soltria.' } as const;
  const db = createAdminClient();
  const { data } = await db.from('identity_stages').select('*').eq('project_id', session.project.id).eq('stage_key', 'briefing').eq('enabled', true).maybeSingle();
  const stage = data as IdentityStage | null;
  if (!stage || stage.status === 'draft') return { ok: false, error: 'O formulário ainda não está disponível.' } as const;
  const { data: v } = await db.from('identity_versions').select('id, content').eq('stage_id', stage.id).eq('version_number', stage.current_version).maybeSingle();
  if (!v) return { ok: false, error: 'Formulário não encontrado.' } as const;
  return { ok: true, session, db, stage, version: v as { id: string; content: Record<string, unknown> } } as const;
}

const done = (token: string) => {
  revalidatePath(`/brand/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
};

/** Salva as respostas (rascunho). Enquanto estiver "aguardando respostas". */
export async function saveBriefingAnswers(token: string, answers: unknown): Promise<ActionResult> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  if (c.stage.status !== 'awaiting') return fail('O formulário já foi enviado. Clique em “Editar respostas” para alterar.');
  const clean = sanitizeAnswers(answers);
  const { error } = await c.db.from('identity_versions').update({ content: { ...c.version.content, answers: clean } }).eq('id', c.version.id);
  if (error) return fail('Não foi possível salvar. Tente novamente.');
  await c.db.from('identity_stages').update({ updated_at: new Date().toISOString() }).eq('id', c.stage.id);
  return { ok: true };
}

/** Envia o formulário: confere as perguntas obrigatórias e marca como respondido. */
export async function submitBriefing(token: string, answers: unknown): Promise<ActionResult<{ missing?: string[] }>> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  if (c.stage.status !== 'awaiting') return fail('O formulário já foi enviado.');
  const clean = sanitizeAnswers(answers);
  const missing = missingRequired(clean);
  if (missing.length) return fail(`Faltam respostas obrigatórias: ${missing.map((q) => q.label.replace(/\?$/, '')).join('; ')}.`);

  await c.db.from('identity_versions').update({ content: { ...c.version.content, answers: clean } }).eq('id', c.version.id);
  const { error } = await c.db.from('identity_stages').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: c.session.signerName }).eq('id', c.stage.id);
  if (error) return fail('Não foi possível enviar. Tente novamente.');
  await c.db.from('identity_approvals').insert({ project_id: c.session.project.id, stage_id: c.stage.id, version_id: c.version.id, action: 'approved', client_name: c.session.signerName, note: 'Formulário respondido' });
  await syncProjectStatus(c.db, c.session.project.id);
  await logIdentity(c.db, { projectId: c.session.project.id, stageId: c.stage.id, actorType: 'client', actorName: c.session.signerName, action: 'approved', detail: 'Formulário da marca respondido' });
  done(token);
  return { ok: true };
}

/** Volta o formulário para edição ("Editar respostas"). */
export async function reopenBriefing(token: string): Promise<ActionResult> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  if (c.stage.status !== 'approved') return fail('O formulário já está aberto para edição.');
  await c.db.from('identity_stages').update({ status: 'awaiting', approved_at: null, approved_by: null }).eq('id', c.stage.id);
  await syncProjectStatus(c.db, c.session.project.id);
  await logIdentity(c.db, { projectId: c.session.project.id, stageId: c.stage.id, actorType: 'client', actorName: c.session.signerName, action: 'briefing', detail: 'Cliente reabriu o formulário para editar as respostas' });
  done(token);
  return { ok: true };
}

/**
 * Passo 1 do envio de uma foto de referência: devolve um endereço de upload assinado e temporário.
 * O arquivo vai direto do celular do cliente para o Storage (sem passar pelo servidor, sem limite de corpo).
 */
export async function createReferenceUpload(token: string, input: { fileName: string; mime: string; size: number }): Promise<ActionResult<{ path: string; uploadToken: string }>> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  if (c.stage.status !== 'awaiting') return fail('O formulário já foi enviado. Clique em “Editar respostas” para adicionar fotos.');
  if (!input.mime.startsWith('image/')) return fail('Envie apenas imagens (JPG, PNG, WEBP…).');
  if (input.size > 15 * 1024 * 1024) return fail('A imagem deve ter até 15 MB.');
  const ext = (input.fileName.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ALLOWED_EXT.includes(ext)) return fail('Formato não aceito. Use JPG, PNG, WEBP, GIF ou AVIF.');
  const { count } = await c.db.from('identity_assets').select('id', { count: 'exact', head: true }).eq('stage_id', c.stage.id).eq('slot', 'reference');
  if ((count ?? 0) >= MAX_REFERENCES) return fail(`Limite de ${MAX_REFERENCES} fotos atingido.`);

  const path = `${c.session.client.owner_id}/${c.session.client.id}/brands/${c.session.project.id}/briefing/${randomUUID()}.${ext}`;
  const { data, error } = await c.db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail('Não foi possível iniciar o envio. Tente novamente.');
  return { ok: true, path, uploadToken: data.token };
}

/** Passo 2: registra a foto já enviada (confere que o caminho é daquele projeto). */
export async function registerReferenceAsset(token: string, input: { path: string; fileName: string; mime: string; caption?: string }): Promise<ActionResult> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  const prefix = `${c.session.client.owner_id}/${c.session.client.id}/brands/${c.session.project.id}/briefing/`;
  if (!input.path.startsWith(prefix) || input.path.includes('..')) return fail('Arquivo inválido.');
  const { data: existing } = await c.db.from('identity_assets').select('position').eq('stage_id', c.stage.id).eq('slot', 'reference');
  const position = Math.max(-1, ...(existing ?? []).map((a) => a.position)) + 1;
  const { error } = await c.db.from('identity_assets').insert({
    project_id: c.session.project.id,
    stage_id: c.stage.id,
    version_id: c.version.id,
    slot: 'reference',
    caption: (input.caption ?? '').slice(0, 300),
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    mime_type: input.mime,
    position,
  });
  if (error) return fail('Foto enviada, mas não foi possível registrá-la.');
  done(token);
  return { ok: true };
}

async function ownAsset(token: string, assetId: string) {
  const c = await ctx(token);
  if (!c.ok) return c;
  const { data: a } = await c.db.from('identity_assets').select('id, storage_path').eq('id', assetId).eq('stage_id', c.stage.id).eq('slot', 'reference').maybeSingle();
  if (!a) return { ok: false, error: 'Foto não encontrada.' } as const;
  return { ...c, asset: a as { id: string; storage_path: string } };
}

export async function updateReferenceCaption(token: string, assetId: string, caption: string): Promise<ActionResult> {
  const c = await ownAsset(token, assetId);
  if (!c.ok) return fail(c.error);
  if (c.stage.status !== 'awaiting') return fail('O formulário já foi enviado.');
  await c.db.from('identity_assets').update({ caption: caption.slice(0, 300) }).eq('id', assetId);
  done(token);
  return { ok: true };
}

export async function removeReferenceAsset(token: string, assetId: string): Promise<ActionResult> {
  const c = await ownAsset(token, assetId);
  if (!c.ok) return fail(c.error);
  if (c.stage.status !== 'awaiting') return fail('O formulário já foi enviado. Clique em “Editar respostas” para remover fotos.');
  await c.db.from('identity_assets').delete().eq('id', assetId);
  const { count } = await c.db.from('identity_assets').select('id', { count: 'exact', head: true }).eq('storage_path', c.asset.storage_path);
  if (!count) await removeFiles([c.asset.storage_path]);
  done(token);
  return { ok: true };
}
