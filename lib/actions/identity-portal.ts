'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveIdentityToken } from '@/lib/data/identity-portal';
import { fetchIdentityDetail, logIdentity, syncProjectStatus } from '@/lib/data/identity';
import { allColors, getFonts, getPalettes } from '@/lib/identity/color';
import { STAGE_BY_KEY, latestLogoVersion, type ApprovalSnapshot, type FavKind, type IdentityDetail, type IdentityStage, type StageData } from '@/lib/identity/types';
import { fail, type ActionResult } from './shared';

/**
 * Ações do CLIENTE no portal de Identidade Visual (/brand/review/<token>).
 * Toda ação valida o token e confere que o item pertence àquele projeto.
 * O cliente nunca altera arquivos nem vê outros projetos.
 */
const pad = (n: number) => String(n).padStart(2, '0');

async function projectContext(token: string) {
  const session = await resolveIdentityToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo. Peça um novo link para a Soltria.' } as const;
  return { ok: true, session, db: createAdminClient() } as const;
}

async function stageContext(token: string, stageId: string) {
  const ctx = await projectContext(token);
  if (!ctx.ok) return ctx;
  const { data } = await ctx.db.from('identity_stages').select('*').eq('id', stageId).eq('project_id', ctx.session.project.id).eq('enabled', true).maybeSingle();
  if (!data) return { ok: false, error: 'Etapa não encontrada.' } as const;
  return { ...ctx, stage: data as IdentityStage };
}

async function versionOf(db: SupabaseClient, stage: IdentityStage) {
  const { data } = await db.from('identity_versions').select('id, version_number').eq('stage_id', stage.id).eq('version_number', stage.current_version).maybeSingle();
  return data as { id: string; version_number: number } | null;
}

const done = (token: string) => {
  revalidatePath(`/brand/review/${token}`, 'layout');
  revalidatePath('/admin', 'layout');
};

const currentVersionOf = (s: StageData | undefined) => s?.versions.find((v) => v.version_number === s.current_version) ?? s?.versions[s.versions.length - 1];

/** O que foi aprovado/escolhido, guardado junto com a aprovação (histórico do projeto). */
function buildSnapshot(d: IdentityDetail, key: StageData['stage_key']): ApprovalSnapshot {
  const stage = (k: string) => d.stages.find((s) => s.stage_key === k && s.enabled);
  const snap: ApprovalSnapshot = {};
  const all = key === 'final';

  if (all || key === 'logo') {
    const chosen = stage('logo')?.proposals.find((p) => p.is_chosen);
    if (chosen) snap.logo = { proposalId: chosen.id, label: chosen.label, versionNumber: latestLogoVersion(chosen)?.version_number ?? 1 };
  }
  if (all || key === 'colors') {
    const content = currentVersionOf(stage('colors'))?.content;
    if (content) {
      const palettes = getPalettes(content);
      const favId = d.favorites.find((f) => f.kind === 'palette')?.ref_id;
      const fav = palettes.find((p) => p.id === favId);
      snap.palette = fav ? { id: fav.id, label: fav.label, colors: fav.colors.map((c) => ({ name: c.name, hex: c.hex })) } : null;
      const sel = [...d.selections].reverse().find((x) => x.kind === 'colors');
      const ids = new Set(sel?.payload.colorIds ?? []);
      const chosen = allColors(content).filter((c) => ids.has(c.id));
      if (chosen.length) snap.colors = chosen.map((c) => ({ name: c.name, hex: c.hex }));
    }
  }
  if (all || key === 'typography') {
    const content = currentVersionOf(stage('typography'))?.content;
    if (content) snap.fonts = getFonts(content).filter((f) => f.name.trim()).map((f) => ({ role: f.role, name: f.name }));
  }
  if (all) {
    snap.stages = d.stages.filter((s) => s.enabled && STAGE_BY_KEY[s.stage_key].approvable).map((s) => ({ key: s.stage_key, label: STAGE_BY_KEY[s.stage_key].label, status: s.status }));
  }
  return snap;
}

export async function approveStage(token: string, stageId: string, versionId: string): Promise<ActionResult> {
  const ctx = await stageContext(token, stageId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage } = ctx;
  if (stage.status !== 'awaiting') return fail('Esta etapa não está aguardando aprovação.');
  const v = await versionOf(db, stage);
  if (!v || v.id !== versionId) return fail('Existe uma versão mais nova desta etapa. Atualize a página.');

  if (stage.stage_key === 'logo') {
    const { count } = await db.from('identity_logo_proposals').select('id', { count: 'exact', head: true }).eq('stage_id', stage.id).eq('is_chosen', true);
    if (!count) return fail('Antes de aprovar o logo, escolha uma das propostas.');
  }
  const detail = await fetchIdentityDetail(db, session.project.id);
  const snapshot = detail ? buildSnapshot(detail, stage.stage_key) : null;

  const now = new Date().toISOString();
  const { error } = await db.from('identity_stages').update({ status: 'approved', approved_at: now, approved_by: session.signerName }).eq('id', stage.id);
  if (error) return fail('Não foi possível registrar a aprovação. Tente novamente.');
  await db.from('identity_approvals').insert({ project_id: session.project.id, stage_id: stage.id, version_id: v.id, action: 'approved', client_name: session.signerName, snapshot });
  await syncProjectStatus(db, session.project.id);

  const label = STAGE_BY_KEY[stage.stage_key].label;
  const extra = snapshot?.logo ? ` — ${snapshot.logo.label} V${snapshot.logo.versionNumber}` : '';
  await logIdentity(db, {
    projectId: session.project.id,
    stageId: stage.id,
    actorType: 'client',
    actorName: session.signerName,
    action: 'approved',
    detail: stage.stage_key === 'final' ? 'Cliente aprovou a identidade visual' : `${label} aprovado(a) (versão ${pad(v.version_number)})${extra}`,
  });
  done(token);
  return { ok: true };
}

export async function requestStageChanges(token: string, stageId: string, versionId: string, message: string): Promise<ActionResult> {
  const text = message.trim();
  if (!text) return fail('Conte para a gente o que você gostaria de alterar.');
  if (text.length > 3000) return fail('O texto está muito longo (máx. 3000 caracteres).');
  const ctx = await stageContext(token, stageId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage } = ctx;
  if (stage.status !== 'awaiting') return fail('Esta etapa não está aguardando aprovação.');
  const v = await versionOf(db, stage);
  if (!v || v.id !== versionId) return fail('Existe uma versão mais nova desta etapa. Atualize a página.');

  const { error } = await db.from('identity_stages').update({ status: 'changes_requested', approved_at: null, approved_by: null }).eq('id', stage.id);
  if (error) return fail('Não foi possível enviar a solicitação. Tente novamente.');
  await db.from('identity_comments').insert({ project_id: session.project.id, stage_id: stage.id, version_id: v.id, author_type: 'client', author_name: session.signerName, message: text, is_change_request: true });
  await db.from('identity_approvals').insert({ project_id: session.project.id, stage_id: stage.id, version_id: v.id, action: 'changes_requested', client_name: session.signerName, note: text });
  await syncProjectStatus(db, session.project.id);
  await logIdentity(db, { projectId: session.project.id, stageId: stage.id, actorType: 'client', actorName: session.signerName, action: 'changes_requested', detail: `${STAGE_BY_KEY[stage.stage_key].label}: cliente solicitou alteração` });
  done(token);
  return { ok: true };
}

export async function addStageComment(token: string, stageId: string, message: string): Promise<ActionResult> {
  const text = message.trim();
  if (!text) return fail('Escreva uma mensagem antes de enviar.');
  if (text.length > 3000) return fail('O texto está muito longo (máx. 3000 caracteres).');
  const ctx = await stageContext(token, stageId);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db, stage } = ctx;
  const v = await versionOf(db, stage);
  await db.from('identity_comments').insert({ project_id: session.project.id, stage_id: stage.id, version_id: v?.id ?? null, author_type: 'client', author_name: session.signerName, message: text });
  await logIdentity(db, { projectId: session.project.id, stageId: stage.id, actorType: 'client', actorName: session.signerName, action: 'comment', detail: `${STAGE_BY_KEY[stage.stage_key].label}: cliente deixou um comentário` });
  done(token);
  return { ok: true };
}

/** Localiza o item a favoritar dentro do projeto e devolve o rótulo. Retorna null se não pertencer ao projeto. */
async function resolveFavorite(db: SupabaseClient, projectId: string, kind: FavKind, refId: string): Promise<{ stageId: string; label: string } | null> {
  const d = await fetchIdentityDetail(db, projectId);
  if (!d) return null;
  const stage = (k: string) => d.stages.find((s) => s.stage_key === k && s.enabled && s.status !== 'draft');
  if (kind === 'logo') {
    const st = stage('logo');
    const p = st?.proposals.find((x) => x.id === refId);
    return st && p ? { stageId: st.id, label: `${p.label} V${latestLogoVersion(p)?.version_number ?? 1}` } : null;
  }
  if (kind === 'palette' || kind === 'color') {
    const st = stage('colors');
    const content = currentVersionOf(st)?.content;
    if (!st || !content) return null;
    if (kind === 'palette') {
      const pal = getPalettes(content).find((p) => p.id === refId);
      return pal ? { stageId: st.id, label: pal.label } : null;
    }
    const c = allColors(content).find((x) => x.id === refId);
    return c ? { stageId: st.id, label: `${c.name || 'Cor'} ${c.hex.toUpperCase()}` } : null;
  }
  if (kind === 'font') {
    const st = stage('typography');
    const content = currentVersionOf(st)?.content;
    const f = content ? getFonts(content).find((x) => x.id === refId) : undefined;
    return st && f ? { stageId: st.id, label: f.name } : null;
  }
  const st = stage('applications');
  const a = st?.versions.flatMap((v) => v.assets).find((x) => x.id === refId);
  return st && a ? { stageId: st.id, label: a.name || a.caption || a.file_name || 'Aplicação' } : null;
}

/** Favoritar NÃO é aprovar: só registra a preferência do cliente (logo, paleta, cor, fonte ou aplicação). */
export async function toggleFavorite(token: string, kind: FavKind, refId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const ctx = await projectContext(token);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db } = ctx;
  const target = await resolveFavorite(db, session.project.id, kind, refId);
  if (!target) return fail('Item não encontrado ou ainda não disponível.');

  const { data: existing } = await db.from('identity_favorites').select('id').eq('project_id', session.project.id).eq('kind', kind).eq('ref_id', refId).maybeSingle();
  if (existing) {
    await db.from('identity_favorites').delete().eq('id', existing.id);
    done(token);
    return { ok: true, favorite: false };
  }
  const { error } = await db.from('identity_favorites').insert({ project_id: session.project.id, stage_id: target.stageId, kind, ref_id: refId, label: target.label });
  if (error) return fail('Não foi possível favoritar.');
  const what = { logo: 'Logo', palette: '', color: 'a cor', font: 'a fonte', application: 'a aplicação' }[kind];
  await logIdentity(db, { projectId: session.project.id, stageId: target.stageId, actorType: 'client', actorName: session.signerName, action: 'favorite', detail: `Cliente favoritou ${what ? `${what} ` : ''}${target.label}` });
  done(token);
  return { ok: true, favorite: true };
}

/** "Escolher esta proposta" (uma só). Aprovar o logo é uma ação separada. */
export async function chooseProposal(token: string, proposalId: string): Promise<ActionResult> {
  const ctx = await projectContext(token);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db } = ctx;
  const { data: p } = await db.from('identity_logo_proposals').select('id, label, stage_id').eq('id', proposalId).maybeSingle();
  if (!p) return fail('Proposta não encontrada.');
  const { data: stage } = await db.from('identity_stages').select('*').eq('id', p.stage_id).eq('project_id', session.project.id).eq('enabled', true).maybeSingle();
  const st = stage as IdentityStage | null;
  if (!st) return fail('Proposta não encontrada.');
  if (st.status !== 'awaiting') return fail('Esta etapa não está aguardando aprovação.');
  await db.from('identity_logo_proposals').update({ is_chosen: false, chosen_at: null }).eq('stage_id', st.id);
  const { error } = await db.from('identity_logo_proposals').update({ is_chosen: true, chosen_at: new Date().toISOString() }).eq('id', p.id);
  if (error) return fail('Não foi possível escolher a proposta.');
  const { data: lv } = await db.from('identity_logo_versions').select('version_number').eq('proposal_id', p.id).order('version_number', { ascending: false }).limit(1);
  await logIdentity(db, { projectId: session.project.id, stageId: st.id, actorType: 'client', actorName: session.signerName, action: 'chosen', detail: `Cliente escolheu ${p.label} V${lv?.[0]?.version_number ?? 1}` });
  done(token);
  return { ok: true };
}

/** "Monte sua paleta" → "Enviar minha seleção". */
export async function submitColorSelection(token: string, colorIds: string[]): Promise<ActionResult> {
  const ctx = await projectContext(token);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db } = ctx;
  if (!colorIds.length) return fail('Selecione ao menos uma cor.');
  const d = await fetchIdentityDetail(db, session.project.id);
  const st = d?.stages.find((s) => s.stage_key === 'colors' && s.enabled && s.status !== 'draft');
  const content = currentVersionOf(st)?.content;
  if (!d || !st || !content) return fail('As cores ainda não estão disponíveis.');
  const valid = new Set(allColors(content).map((c) => c.id));
  const ids = [...new Set(colorIds)].filter((id) => valid.has(id));
  if (!ids.length) return fail('Seleção inválida.');
  const { error } = await db.from('identity_selections').insert({ project_id: session.project.id, stage_id: st.id, kind: 'colors', payload: { colorIds: ids }, client_name: session.signerName });
  if (error) return fail('Não foi possível enviar a seleção.');
  await logIdentity(db, { projectId: session.project.id, stageId: st.id, actorType: 'client', actorName: session.signerName, action: 'selection', detail: `Cliente enviou a seleção de cores (${ids.length} ${ids.length === 1 ? 'cor' : 'cores'})` });
  done(token);
  return { ok: true };
}

/** Comentário em uma imagem: com marcador numerado (x, y em %) ou geral da imagem. */
export async function addAssetAnnotation(token: string, input: { assetId: string; x?: number | null; y?: number | null; message: string }): Promise<ActionResult> {
  const text = input.message.trim();
  if (!text) return fail('Escreva o comentário.');
  if (text.length > 2000) return fail('O texto está muito longo.');
  const ctx = await projectContext(token);
  if (!ctx.ok) return fail(ctx.error);
  const { session, db } = ctx;
  const { data: asset } = await db.from('identity_assets').select('id, stage_id').eq('id', input.assetId).eq('project_id', session.project.id).maybeSingle();
  if (!asset) return fail('Imagem não encontrada.');
  const { data: st } = await db.from('identity_stages').select('status, enabled, stage_key').eq('id', asset.stage_id).maybeSingle();
  if (!st || !st.enabled || st.status === 'draft') return fail('Esta etapa ainda não está disponível.');

  const hasPoint = typeof input.x === 'number' && typeof input.y === 'number';
  let number: number | null = null;
  if (hasPoint) {
    const { count } = await db.from('identity_annotations').select('id', { count: 'exact', head: true }).eq('asset_id', asset.id).not('x', 'is', null);
    number = (count ?? 0) + 1;
  }
  const { error } = await db.from('identity_annotations').insert({
    project_id: session.project.id,
    stage_id: asset.stage_id,
    asset_id: asset.id,
    x: hasPoint ? Math.max(0, Math.min(100, input.x!)) : null,
    y: hasPoint ? Math.max(0, Math.min(100, input.y!)) : null,
    number,
    message: text,
    author_type: 'client',
    author_name: session.signerName,
  });
  if (error) return fail('Não foi possível salvar o comentário.');
  await logIdentity(db, { projectId: session.project.id, stageId: asset.stage_id, actorType: 'client', actorName: session.signerName, action: 'annotation', detail: `${STAGE_BY_KEY[st.stage_key as StageData['stage_key']].label}: cliente comentou em uma imagem${number ? ` (marcador ${number})` : ''}` });
  done(token);
  return { ok: true };
}
