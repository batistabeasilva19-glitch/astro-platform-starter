'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveIdentityToken } from '@/lib/data/identity-portal';
import { logIdentity, syncProjectStatus } from '@/lib/data/identity';
import { STAGE_BY_KEY, type IdentityStage } from '@/lib/identity/types';
import { fail, type ActionResult } from './shared';

/**
 * Ações do CLIENTE no portal de Identidade Visual.
 * Toda ação valida o token e confere que a etapa pertence àquele projeto.
 */
const pad = (n: number) => String(n).padStart(2, '0');

async function context(token: string, stageId: string) {
  const session = await resolveIdentityToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo. Peça um novo link para a Soltria.' } as const;
  const db = createAdminClient();
  const { data } = await db.from('identity_stages').select('*').eq('id', stageId).eq('project_id', session.project.id).eq('enabled', true).maybeSingle();
  if (!data) return { ok: false, error: 'Etapa não encontrada.' } as const;
  return { ok: true, session, db, stage: data as IdentityStage } as const;
}

async function versionOf(db: SupabaseClient, stage: IdentityStage) {
  const { data } = await db.from('identity_versions').select('id, version_number').eq('stage_id', stage.id).eq('version_number', stage.current_version).maybeSingle();
  return data as { id: string; version_number: number } | null;
}

const done = (token: string) => {
  revalidatePath(`/identidade/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
};

export async function approveStage(token: string, stageId: string, versionId: string): Promise<ActionResult> {
  const ctx = await context(token, stageId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage } = ctx;
  if (stage.status !== 'awaiting') return fail('Esta etapa não está aguardando aprovação.');
  const v = await versionOf(db, stage);
  if (!v || v.id !== versionId) return fail('Existe uma versão mais nova desta etapa. Atualize a página.');

  if (stage.stage_key === 'logo') {
    const { count } = await db.from('identity_logo_proposals').select('id', { count: 'exact', head: true }).eq('version_id', v.id).eq('is_chosen', true);
    if (!count) return fail('Antes de aprovar o logo, escolha uma das propostas.');
  }
  const now = new Date().toISOString();
  const { error } = await db.from('identity_stages').update({ status: 'approved', approved_at: now, approved_by: session.signerName }).eq('id', stage.id);
  if (error) return fail('Não foi possível registrar a aprovação. Tente novamente.');
  await db.from('identity_approvals').insert({ project_id: session.project.id, stage_id: stage.id, version_id: v.id, action: 'approved', client_name: session.signerName });
  await syncProjectStatus(db, session.project.id);
  await logIdentity(db, {
    projectId: session.project.id,
    stageId: stage.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'approved',
    detail: `${STAGE_BY_KEY[stage.stage_key].label} aprovado(a) (versão ${pad(v.version_number)})`,
  });
  done(token);
  return { ok: true };
}

export async function requestStageChanges(token: string, stageId: string, versionId: string, message: string): Promise<ActionResult> {
  const text = message.trim();
  if (!text) return fail('Conte para a gente o que você gostaria de alterar.');
  if (text.length > 3000) return fail('O texto está muito longo (máx. 3000 caracteres).');
  const ctx = await context(token, stageId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage } = ctx;
  if (stage.status !== 'awaiting') return fail('Esta etapa não está aguardando aprovação.');
  const v = await versionOf(db, stage);
  if (!v || v.id !== versionId) return fail('Existe uma versão mais nova desta etapa. Atualize a página.');

  const { error } = await db.from('identity_stages').update({ status: 'changes_requested', approved_at: null, approved_by: null }).eq('id', stage.id);
  if (error) return fail('Não foi possível enviar a solicitação. Tente novamente.');
  await db.from('identity_comments').insert({
    project_id: session.project.id,
    stage_id: stage.id,
    version_id: v.id,
    author_type: 'client',
    author_name: session.signerName,
    message: text,
    is_change_request: true,
  });
  await db.from('identity_approvals').insert({ project_id: session.project.id, stage_id: stage.id, version_id: v.id, action: 'changes_requested', client_name: session.signerName, note: text });
  await syncProjectStatus(db, session.project.id);
  await logIdentity(db, {
    projectId: session.project.id,
    stageId: stage.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'changes_requested',
    detail: `${STAGE_BY_KEY[stage.stage_key].label}: solicitou alteração`,
  });
  done(token);
  return { ok: true };
}

export async function addStageComment(token: string, stageId: string, message: string): Promise<ActionResult> {
  const text = message.trim();
  if (!text) return fail('Escreva uma mensagem antes de enviar.');
  if (text.length > 3000) return fail('O texto está muito longo (máx. 3000 caracteres).');
  const ctx = await context(token, stageId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage } = ctx;
  const v = await versionOf(db, stage);
  await db.from('identity_comments').insert({
    project_id: session.project.id,
    stage_id: stage.id,
    version_id: v?.id ?? null,
    author_type: 'client',
    author_name: session.signerName,
    message: text,
  });
  await logIdentity(db, {
    projectId: session.project.id,
    stageId: stage.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'comment',
    detail: `${STAGE_BY_KEY[stage.stage_key].label}: deixou um comentário`,
  });
  done(token);
  return { ok: true };
}

/** Proposta de logo da versão atual de uma etapa em análise. */
async function proposalContext(token: string, proposalId: string) {
  const session = await resolveIdentityToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo.' } as const;
  const db = createAdminClient();
  const { data: p } = await db.from('identity_logo_proposals').select('*').eq('id', proposalId).maybeSingle();
  if (!p) return { ok: false, error: 'Proposta não encontrada.' } as const;
  const { data: stage } = await db.from('identity_stages').select('*').eq('id', p.stage_id).eq('project_id', session.project.id).eq('enabled', true).maybeSingle();
  if (!stage) return { ok: false, error: 'Proposta não encontrada.' } as const;
  const st = stage as IdentityStage;
  const v = await versionOf(db, st);
  if (!v || v.id !== p.version_id) return { ok: false, error: 'Existe uma versão mais nova. Atualize a página.' } as const;
  if (st.status !== 'awaiting') return { ok: false, error: 'Esta etapa não está aguardando aprovação.' } as const;
  return { ok: true, session, db, stage: st, proposal: p as { id: string; label: string; is_favorite: boolean; version_id: string } } as const;
}

/** Favoritar NÃO é aprovar: apenas marca a preferência do cliente. */
export async function toggleFavorite(token: string, proposalId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const ctx = await proposalContext(token, proposalId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage, proposal } = ctx;
  const next = !proposal.is_favorite;
  const { error } = await db.from('identity_logo_proposals').update({ is_favorite: next }).eq('id', proposal.id);
  if (error) return fail('Não foi possível favoritar.');
  if (next) {
    await logIdentity(db, { projectId: session.project.id, stageId: stage.id, actorType: 'client', actorName: session.signerName, action: 'favorite', detail: `Logo: marcou a ${proposal.label} como favorita` });
  }
  done(token);
  return { ok: true, favorite: next };
}

/** Escolher a proposta (uma por versão). A aprovação do logo é um passo seguinte. */
export async function chooseProposal(token: string, proposalId: string): Promise<ActionResult> {
  const ctx = await proposalContext(token, proposalId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage, proposal } = ctx;
  await db.from('identity_logo_proposals').update({ is_chosen: false, chosen_at: null }).eq('version_id', proposal.version_id);
  const { error } = await db.from('identity_logo_proposals').update({ is_chosen: true, chosen_at: new Date().toISOString() }).eq('id', proposal.id);
  if (error) return fail('Não foi possível escolher a proposta.');
  await logIdentity(db, { projectId: session.project.id, stageId: stage.id, actorType: 'client', actorName: session.signerName, action: 'chosen', detail: `Logo: escolheu a ${proposal.label}` });
  done(token);
  return { ok: true };
}
