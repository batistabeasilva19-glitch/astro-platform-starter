'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { logIdentity, syncProjectStatus } from '@/lib/data/identity';
import { removeFiles } from '@/lib/storage';
import { HEX_RE, IDENTITY_STATUSES, STAGES, STAGE_BY_KEY, type IdentityStage, type IdentityStatus, type StageContent, type StageKey } from '@/lib/identity/types';
import { fail, type ActionResult } from './shared';

const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/identidade', 'layout');
};
const pad = (n: number) => String(n).padStart(2, '0');
const newToken = () => randomBytes(32).toString('hex');

type Supa = Awaited<ReturnType<typeof createClient>>;

async function ownedStage(stageId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('identity_stages').select('*').eq('id', stageId).maybeSingle();
  return { supabase, stage: (data as IdentityStage | null) ?? null };
}

async function currentVersion(supabase: Supa, stage: IdentityStage) {
  const { data } = await supabase
    .from('identity_versions')
    .select('id, version_number, content')
    .eq('stage_id', stage.id)
    .eq('version_number', stage.current_version)
    .maybeSingle();
  return data as { id: string; version_number: number; content: StageContent } | null;
}

/** Apaga linhas de arquivo e remove do Storage o que nenhuma outra versão usa. */
async function dropAssets(supabase: Supa, rows: { id: string; storage_path: string }[]) {
  for (const row of rows) {
    await supabase.from('identity_assets').delete().eq('id', row.id);
    const { count } = await supabase.from('identity_assets').select('id', { count: 'exact', head: true }).eq('storage_path', row.storage_path);
    if (!count) await removeFiles([row.storage_path]);
  }
}

// ─── Projeto ───────────────────────────────────────────────────────────────
const projectSchema = z.object({
  client_id: z.string().uuid('Selecione um cliente.'),
  name: z.string().trim().min(1, 'Dê um nome ao projeto.').max(160),
  description: z.string().trim().max(3000).default(''),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  internal_notes: z.string().trim().max(3000).default(''),
  status: z.enum(IDENTITY_STATUSES as [IdentityStatus, ...IdentityStatus[]]).default('in_creation'),
});

function parseProject(fd: FormData) {
  return projectSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
}

export async function createIdentityProject(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const parsed = parseProject(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const { data: client } = await supabase.from('clients').select('id').eq('id', v.client_id).maybeSingle();
  if (!client) return fail('Cliente não encontrado.');

  const { data: project, error } = await supabase
    .from('identity_projects')
    .insert({
      client_id: v.client_id,
      name: v.name,
      description: v.description,
      start_date: v.start_date || null,
      internal_notes: v.internal_notes,
      status: v.status,
      review_token: newToken(),
    })
    .select('id')
    .single();
  if (error || !project) return fail('Não foi possível criar o projeto. A migration 0002 foi aplicada no Supabase?');

  const { data: stages, error: sErr } = await supabase
    .from('identity_stages')
    .insert(STAGES.map((s) => ({ project_id: project.id, stage_key: s.key })))
    .select('id');
  if (sErr || !stages) return fail('Projeto criado, mas as etapas falharam.');
  await supabase.from('identity_versions').insert(stages.map((s) => ({ stage_id: s.id, version_number: 1, content: {} })));
  await logIdentity(supabase, { projectId: project.id, actorType: 'admin', action: 'created', detail: 'Projeto de identidade visual criado' });

  refresh();
  redirect(`/admin/identidades/${project.id}`);
}

export async function updateIdentityProject(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const id = String(fd.get('id') || '');
  const parsed = parseProject(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const { error } = await supabase
    .from('identity_projects')
    .update({ name: v.name, description: v.description, start_date: v.start_date || null, internal_notes: v.internal_notes, status: v.status })
    .eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  await logIdentity(supabase, { projectId: id, actorType: 'admin', action: 'updated', detail: 'Dados do projeto atualizados' });
  refresh();
  return { ok: true };
}

export async function deleteIdentityProject(projectId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: assets } = await supabase.from('identity_assets').select('storage_path').eq('project_id', projectId);
  const { error } = await supabase.from('identity_projects').delete().eq('id', projectId);
  if (error) return fail('Não foi possível excluir o projeto.');
  await removeFiles((assets ?? []).map((a) => a.storage_path));
  refresh();
  return { ok: true };
}

export async function finalizeIdentityProject(projectId: string, finalized: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('identity_projects').update({ status: finalized ? 'finalized' : 'in_creation' }).eq('id', projectId);
  if (error) return fail('Não foi possível alterar o status.');
  if (!finalized) await syncProjectStatus(supabase, projectId);
  await logIdentity(supabase, { projectId, actorType: 'admin', action: 'status', detail: finalized ? 'Projeto finalizado' : 'Projeto reaberto' });
  refresh();
  return { ok: true };
}

// ─── Link público ──────────────────────────────────────────────────────────
export async function regenerateIdentityLink(projectId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('identity_projects')
    .update({ review_token: newToken(), token_active: true, token_rotated_at: new Date().toISOString() })
    .eq('id', projectId);
  if (error) return fail('Não foi possível gerar um novo link.');
  await logIdentity(supabase, { projectId, actorType: 'admin', action: 'link', detail: 'Novo link de aprovação gerado' });
  refresh();
  return { ok: true };
}

export async function setIdentityLinkActive(projectId: string, active: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('identity_projects').update({ token_active: active }).eq('id', projectId);
  if (error) return fail('Não foi possível alterar o link.');
  await logIdentity(supabase, { projectId, actorType: 'admin', action: 'link', detail: active ? 'Link reativado' : 'Link revogado' });
  refresh();
  return { ok: true };
}

// ─── Etapas ────────────────────────────────────────────────────────────────
export async function setStageEnabled(stageId: string, enabled: boolean): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  const { error } = await supabase.from('identity_stages').update({ enabled }).eq('id', stageId);
  if (error) return fail('Não foi possível alterar a etapa.');
  await syncProjectStatus(supabase, stage.project_id);
  await logIdentity(supabase, {
    projectId: stage.project_id,
    stageId,
    actorType: 'admin',
    action: 'stage',
    detail: `Etapa ${STAGE_BY_KEY[stage.stage_key].label} ${enabled ? 'ativada' : 'desativada'}`,
  });
  refresh();
  return { ok: true };
}

export async function saveStageContent(stageId: string, content: StageContent): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  if (JSON.stringify(content).length > 120_000) return fail('Conteúdo muito grande.');
  for (const c of content.colors ?? []) {
    if (!HEX_RE.test(c.hex)) return fail(`Cor inválida: "${c.hex}". Use o formato #RRGGBB.`);
  }
  const v = await currentVersion(supabase, stage);
  if (!v) return fail('Versão atual não encontrada.');
  const { error } = await supabase.from('identity_versions').update({ content }).eq('id', v.id);
  if (error) return fail('Não foi possível salvar.');
  await supabase.from('identity_stages').update({ updated_at: new Date().toISOString() }).eq('id', stageId);
  await supabase.from('identity_projects').update({ updated_at: new Date().toISOString() }).eq('id', stage.project_id);
  refresh();
  return { ok: true };
}

export async function sendStageForApproval(stageId: string): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  const meta = STAGE_BY_KEY[stage.stage_key];
  if (!meta.approvable) return fail('Esta etapa não precisa de aprovação.');
  const v = await currentVersion(supabase, stage);
  if (!v) return fail('Versão atual não encontrada.');

  const [{ data: assets }, { data: proposals }] = await Promise.all([
    supabase.from('identity_assets').select('id, proposal_id').eq('version_id', v.id),
    supabase.from('identity_logo_proposals').select('id').eq('version_id', v.id),
  ]);
  const c = v.content;
  const hasText = Object.entries(c).some(([k, val]) => typeof val === 'string' && val.trim() && k !== 'title');
  const missing: Record<StageKey, string | null> = {
    concept: hasText || (assets?.length ?? 0) > 0 ? null : 'Preencha ao menos um campo do conceito.',
    moodboard: (assets?.length ?? 0) > 0 ? null : 'Adicione imagens ao moodboard.',
    logo: (proposals?.length ?? 0) > 0 && (assets ?? []).some((a) => a.proposal_id) ? null : 'Crie ao menos uma proposta com um arquivo de logo.',
    colors: (c.colors?.length ?? 0) > 0 ? null : 'Adicione ao menos uma cor.',
    typography: (c.fonts?.length ?? 0) > 0 ? null : 'Adicione ao menos uma fonte.',
    elements: (assets?.length ?? 0) > 0 ? null : 'Adicione ao menos um elemento.',
    applications: (assets?.length ?? 0) > 0 ? null : 'Adicione ao menos uma aplicação.',
    final: null,
    files: null,
  };
  if (stage.stage_key === 'final') {
    const { data: others } = await supabase
      .from('identity_stages')
      .select('stage_key, enabled, status')
      .eq('project_id', stage.project_id);
    const pending = (others ?? []).filter((o) => o.enabled && o.stage_key !== 'final' && STAGE_BY_KEY[o.stage_key as StageKey].approvable && o.status !== 'approved');
    if (pending.length) return fail(`Ainda faltam aprovar: ${pending.map((p) => STAGE_BY_KEY[p.stage_key as StageKey].label).join(', ')}.`);
  }
  if (missing[stage.stage_key]) return fail(`${meta.label}: ${missing[stage.stage_key]}`);

  const { error } = await supabase
    .from('identity_stages')
    .update({ status: 'awaiting', sent_at: new Date().toISOString(), approved_at: null, approved_by: null })
    .eq('id', stageId);
  if (error) return fail('Não foi possível enviar para aprovação.');
  await syncProjectStatus(supabase, stage.project_id);
  await logIdentity(supabase, {
    projectId: stage.project_id,
    stageId,
    actorType: 'admin',
    action: 'sent',
    detail: `${meta.label} enviado(a) para aprovação (versão ${pad(v.version_number)})`,
  });
  refresh();
  return { ok: true };
}

/** Versão N+1 = cópia da atual (conteúdo, propostas e arquivos). As anteriores ficam preservadas. */
export async function createStageVersion(stageId: string, note: string): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  const cur = await currentVersion(supabase, stage);
  if (!cur) return fail('Versão atual não encontrada.');
  const next = stage.current_version + 1;

  const { data: nv, error } = await supabase
    .from('identity_versions')
    .insert({ stage_id: stageId, version_number: next, content: cur.content, note: note.trim() })
    .select('id')
    .single();
  if (error || !nv) return fail('Não foi possível criar a nova versão.');

  const [{ data: proposals }, { data: assets }] = await Promise.all([
    supabase.from('identity_logo_proposals').select('*').eq('version_id', cur.id).order('position'),
    supabase.from('identity_assets').select('*').eq('version_id', cur.id).order('position'),
  ]);
  const idMap = new Map<string, string>();
  for (const p of proposals ?? []) {
    const { data: np } = await supabase
      .from('identity_logo_proposals')
      .insert({ stage_id: stageId, version_id: nv.id, label: p.label, description: p.description, position: p.position, is_favorite: p.is_favorite })
      .select('id')
      .single();
    if (np) idMap.set(p.id, np.id);
  }
  if (assets?.length) {
    await supabase.from('identity_assets').insert(
      assets.map((a) => ({
        project_id: a.project_id,
        stage_id: stageId,
        version_id: nv.id,
        proposal_id: a.proposal_id ? (idMap.get(a.proposal_id) ?? null) : null,
        slot: a.slot,
        caption: a.caption,
        storage_path: a.storage_path, // mesmo arquivo; só é apagado quando nenhuma versão o usa
        file_name: a.file_name,
        mime_type: a.mime_type,
        position: a.position,
      })),
    );
  }
  // volta a "em criação": o cliente só vê a nova versão quando você enviar
  await supabase.from('identity_stages').update({ current_version: next, status: 'draft', approved_at: null, approved_by: null }).eq('id', stageId);
  await syncProjectStatus(supabase, stage.project_id);
  await logIdentity(supabase, {
    projectId: stage.project_id,
    stageId,
    actorType: 'admin',
    action: 'new_version',
    detail: `${STAGE_BY_KEY[stage.stage_key].label}: nova versão adicionada (versão ${pad(next)})`,
  });
  refresh();
  return { ok: true };
}

// ─── Arquivos ──────────────────────────────────────────────────────────────
export async function registerIdentityAsset(input: {
  stageId: string;
  versionId: string;
  proposalId?: string | null;
  slot?: string;
  path: string;
  mime: string;
  fileName: string;
  /** substitui o arquivo existente no mesmo slot (variantes de logo). */
  replaceSlot?: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();
  const { supabase, stage } = await ownedStage(input.stageId);
  if (!stage) return fail('Etapa não encontrada.');
  if (!input.path.startsWith(`${user.id}/`)) return fail('Caminho de arquivo inválido.');
  const v = await currentVersion(supabase, stage);
  if (!v || v.id !== input.versionId) return fail('Só é possível editar a versão atual.');

  const slot = input.slot ?? 'image';
  const { data: existing } = await supabase.from('identity_assets').select('id, storage_path, position, proposal_id, slot').eq('version_id', v.id);
  const sameProposal = (a: { proposal_id: string | null }) => (a.proposal_id ?? null) === (input.proposalId ?? null);

  if (input.replaceSlot) {
    await dropAssets(supabase, (existing ?? []).filter((a) => sameProposal(a) && a.slot === slot));
  }
  const position = Math.max(-1, ...(existing ?? []).filter(sameProposal).map((a) => a.position)) + 1;
  const { data: project } = await supabase.from('identity_projects').select('id').eq('id', stage.project_id).single();

  const { error } = await supabase.from('identity_assets').insert({
    project_id: project!.id,
    stage_id: stage.id,
    version_id: v.id,
    proposal_id: input.proposalId ?? null,
    slot,
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    mime_type: input.mime,
    position,
  });
  if (error) return fail('Arquivo enviado, mas não foi possível registrá-lo.');
  await supabase.from('identity_projects').update({ updated_at: new Date().toISOString() }).eq('id', stage.project_id);
  refresh();
  return { ok: true };
}

export async function removeIdentityAsset(assetId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: a } = await supabase.from('identity_assets').select('id, storage_path').eq('id', assetId).maybeSingle();
  if (!a) return fail('Arquivo não encontrado.');
  await dropAssets(supabase, [a]);
  refresh();
  return { ok: true };
}

export async function reorderIdentityAssets(versionId: string, orderedIds: string[]): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  await Promise.all(orderedIds.map((id, i) => supabase.from('identity_assets').update({ position: i }).eq('id', id).eq('version_id', versionId)));
  refresh();
  return { ok: true };
}

export async function updateIdentityAssetCaption(assetId: string, caption: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('identity_assets').update({ caption: caption.slice(0, 300) }).eq('id', assetId);
  if (error) return fail('Não foi possível salvar a legenda.');
  return { ok: true };
}

// ─── Propostas de logo ─────────────────────────────────────────────────────
export async function addLogoProposal(stageId: string): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  const v = await currentVersion(supabase, stage);
  if (!v) return fail('Versão atual não encontrada.');
  const { count } = await supabase.from('identity_logo_proposals').select('id', { count: 'exact', head: true }).eq('version_id', v.id);
  const n = count ?? 0;
  const { error } = await supabase
    .from('identity_logo_proposals')
    .insert({ stage_id: stageId, version_id: v.id, label: `Proposta ${String.fromCharCode(65 + (n % 26))}`, position: n });
  if (error) return fail('Não foi possível criar a proposta.');
  refresh();
  return { ok: true };
}

export async function updateLogoProposal(proposalId: string, label: string, description: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (!label.trim()) return fail('Dê um nome à proposta.');
  const { error } = await supabase
    .from('identity_logo_proposals')
    .update({ label: label.trim().slice(0, 80), description: description.slice(0, 1000) })
    .eq('id', proposalId);
  if (error) return fail('Não foi possível salvar a proposta.');
  refresh();
  return { ok: true };
}

export async function removeLogoProposal(proposalId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: assets } = await supabase.from('identity_assets').select('storage_path').eq('proposal_id', proposalId);
  const { error } = await supabase.from('identity_logo_proposals').delete().eq('id', proposalId);
  if (error) return fail('Não foi possível remover a proposta.');
  for (const a of assets ?? []) {
    const { count } = await supabase.from('identity_assets').select('id', { count: 'exact', head: true }).eq('storage_path', a.storage_path);
    if (!count) await removeFiles([a.storage_path]);
  }
  refresh();
  return { ok: true };
}

// ─── Comentários ───────────────────────────────────────────────────────────
export async function addAdminIdentityComment(stageId: string, message: string): Promise<ActionResult> {
  const user = await requireUser();
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  const text = message.trim();
  if (!text) return fail('Escreva uma mensagem.');
  const [{ data: prof }, v] = await Promise.all([supabase.from('users').select('name').eq('id', user.id).maybeSingle(), currentVersion(supabase, stage)]);
  const { error } = await supabase.from('identity_comments').insert({
    project_id: stage.project_id,
    stage_id: stageId,
    version_id: v?.id ?? null,
    author_type: 'admin',
    author_name: prof?.name || 'Soltria',
    message: text,
  });
  if (error) return fail('Não foi possível enviar o comentário.');
  await logIdentity(supabase, {
    projectId: stage.project_id,
    stageId,
    actorType: 'admin',
    actorName: prof?.name || 'Soltria',
    action: 'comment',
    detail: `${STAGE_BY_KEY[stage.stage_key].label}: respondeu no chat`,
  });
  refresh();
  return { ok: true };
}

/** "Arquivos" não tem aprovação: a administradora só publica/despublica para o cliente. */
export async function setFilesPublished(stageId: string, published: boolean): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage || stage.stage_key !== 'files') return fail('Etapa não encontrada.');
  const { error } = await supabase
    .from('identity_stages')
    .update({ status: published ? 'approved' : 'draft', sent_at: published ? new Date().toISOString() : null })
    .eq('id', stageId);
  if (error) return fail('Não foi possível alterar a publicação.');
  await logIdentity(supabase, { projectId: stage.project_id, stageId, actorType: 'admin', action: 'sent', detail: published ? 'Arquivos publicados para o cliente' : 'Arquivos despublicados' });
  refresh();
  return { ok: true };
}
