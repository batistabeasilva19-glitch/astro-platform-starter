'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { logIdentity, syncProjectStatus } from '@/lib/data/identity';
import { removeFiles } from '@/lib/storage';
import { HEX_RE, IDENTITY_STATUSES, STAGES, STAGE_BY_KEY, type IdentityStage, type IdentityStatus, type QuickLink, type StageContent, type StageKey } from '@/lib/identity/types';
import { getFonts, getPalettes } from '@/lib/identity/color';
import { fail, type ActionResult } from './shared';

const refresh = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/brand', 'layout');
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
  for (const pal of content.palettes ?? []) {
    for (const c of pal.colors) {
      if (!HEX_RE.test(c.hex)) return fail(`Cor inválida: "${c.hex}" (${pal.label}). Use o formato #RRGGBB.`);
    }
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

  const { data: assets } = await supabase.from('identity_assets').select('id, proposal_id').eq('version_id', v.id);
  const c = v.content;
  const hasText = Object.entries(c).some(([k, val]) => typeof val === 'string' && val.trim() && k !== 'title');
  let logoOk = false;
  if (stage.stage_key === 'logo') {
    const { data: props } = await supabase.from('identity_logo_proposals').select('id').eq('stage_id', stage.id);
    const ids = (props ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: lvs } = await supabase.from('identity_logo_versions').select('id, proposal_id, version_number').in('proposal_id', ids);
      const latest = new Map<string, { id: string; n: number }>();
      for (const lv of lvs ?? []) if (!latest.has(lv.proposal_id) || latest.get(lv.proposal_id)!.n < lv.version_number) latest.set(lv.proposal_id, { id: lv.id, n: lv.version_number });
      const latestIds = [...latest.values()].map((x) => x.id);
      const { count } = latestIds.length ? await supabase.from('identity_assets').select('id', { count: 'exact', head: true }).in('logo_version_id', latestIds) : { count: 0 };
      logoOk = (count ?? 0) > 0;
    }
  }
  const missing: Record<StageKey, string | null> = {
    concept: hasText || (assets?.length ?? 0) > 0 ? null : 'Preencha ao menos um campo do conceito.',
    moodboard: (assets?.length ?? 0) > 0 ? null : 'Adicione imagens ao moodboard.',
    logo: logoOk ? null : 'Crie ao menos uma proposta com um arquivo de logo.',
    colors: getPalettes(c).some((p) => p.colors.length) ? null : 'Adicione ao menos uma paleta com cores.',
    typography: getFonts(c).some((f) => f.name.trim()) ? null : 'Adicione ao menos uma fonte.',
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
  if (stage.stage_key === 'logo') return fail('No logo, crie a nova versão dentro de cada proposta.');
  const cur = await currentVersion(supabase, stage);
  if (!cur) return fail('Versão atual não encontrada.');
  const next = stage.current_version + 1;

  const { data: nv, error } = await supabase
    .from('identity_versions')
    .insert({ stage_id: stageId, version_number: next, content: cur.content, note: note.trim() })
    .select('id')
    .single();
  if (error || !nv) return fail('Não foi possível criar a nova versão.');

  const { data: assets } = await supabase.from('identity_assets').select('*').eq('version_id', cur.id).is('proposal_id', null).order('position');
  if (assets?.length) {
    await supabase.from('identity_assets').insert(
      assets.map((a) => ({
        project_id: a.project_id,
        stage_id: stageId,
        version_id: nv.id,
        slot: a.slot,
        name: a.name,
        description: a.description,
        category: a.category,
        released: a.released,
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
  logoVersionId?: string | null;
  slot?: string;
  path: string;
  mime: string;
  fileName: string;
  /** substitui o arquivo existente no mesmo slot (variações de logo). */
  replaceSlot?: boolean;
  name?: string;
  category?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const { supabase, stage } = await ownedStage(input.stageId);
  if (!stage) return fail('Etapa não encontrada.');
  if (!input.path.startsWith(`${user.id}/`)) return fail('Caminho de arquivo inválido.');
  const slot = input.slot ?? 'image';

  let versionId = input.versionId;
  if (input.logoVersionId) {
    // variação de logo: só a versão mais recente da proposta pode ser editada
    const { data: lv } = await supabase.from('identity_logo_versions').select('id, proposal_id, version_number').eq('id', input.logoVersionId).maybeSingle();
    if (!lv || lv.proposal_id !== input.proposalId) return fail('Versão do logo não encontrada.');
    const { data: all } = await supabase.from('identity_logo_versions').select('version_number').eq('proposal_id', lv.proposal_id);
    if (Math.max(...(all ?? []).map((x) => x.version_number)) !== lv.version_number) return fail('Só a versão mais recente pode ser editada. Use “Nova versão”.');
    const cur = await currentVersion(supabase, stage);
    if (!cur) return fail('Versão da etapa não encontrada.');
    versionId = cur.id;
  } else {
    const v = await currentVersion(supabase, stage);
    if (!v || v.id !== input.versionId) return fail('Só é possível editar a versão atual.');
  }

  const q = supabase.from('identity_assets').select('id, storage_path, position, slot');
  const { data: existing } = input.logoVersionId ? await q.eq('logo_version_id', input.logoVersionId) : await q.eq('version_id', versionId).is('proposal_id', null);
  if (input.replaceSlot) await dropAssets(supabase, (existing ?? []).filter((a) => a.slot === slot));
  const position = Math.max(-1, ...(existing ?? []).filter((a) => !input.replaceSlot || a.slot !== slot).map((a) => a.position)) + 1;

  const { error } = await supabase.from('identity_assets').insert({
    project_id: stage.project_id,
    stage_id: stage.id,
    version_id: versionId,
    proposal_id: input.proposalId ?? null,
    logo_version_id: input.logoVersionId ?? null,
    slot,
    name: input.name ?? '',
    category: input.category ?? '',
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

/** Nome, descrição, categoria e legenda de um arquivo (elementos, aplicações, arquivos finais). */
export async function updateIdentityAsset(assetId: string, patch: { name?: string; description?: string; category?: string; caption?: string }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const row: Record<string, string> = {};
  if (patch.name !== undefined) row.name = patch.name.slice(0, 160);
  if (patch.description !== undefined) row.description = patch.description.slice(0, 1000);
  if (patch.category !== undefined) row.category = patch.category.slice(0, 80);
  if (patch.caption !== undefined) row.caption = patch.caption.slice(0, 300);
  const { error } = await supabase.from('identity_assets').update(row).eq('id', assetId);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}

/** "Disponibilizar para cliente [ON/OFF]" — arquivos de trabalho nunca ficam liberados automaticamente. */
export async function setAssetReleased(assetId: string, released: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: a } = await supabase.from('identity_assets').select('project_id, file_name, name').eq('id', assetId).maybeSingle();
  if (!a) return fail('Arquivo não encontrado.');
  const { error } = await supabase.from('identity_assets').update({ released }).eq('id', assetId);
  if (error) return fail('Não foi possível alterar a liberação.');
  await logIdentity(supabase, { projectId: a.project_id, actorType: 'admin', action: 'release', detail: `Arquivo “${a.name || a.file_name}” ${released ? 'liberado' : 'bloqueado'} para o cliente` });
  refresh();
  return { ok: true };
}

// ─── Propostas de logo e suas versões ──────────────────────────────────────
export async function addLogoProposal(stageId: string): Promise<ActionResult> {
  const { supabase, stage } = await ownedStage(stageId);
  if (!stage) return fail('Etapa não encontrada.');
  const v = await currentVersion(supabase, stage);
  if (!v) return fail('Versão atual não encontrada.');
  const { count } = await supabase.from('identity_logo_proposals').select('id', { count: 'exact', head: true }).eq('stage_id', stageId);
  const n = count ?? 0;
  const { data: p, error } = await supabase
    .from('identity_logo_proposals')
    .insert({ stage_id: stageId, version_id: v.id, label: `Proposta ${String.fromCharCode(65 + (n % 26))}`, position: n })
    .select('id, label')
    .single();
  if (error || !p) return fail('Não foi possível criar a proposta.');
  const { error: vErr } = await supabase.from('identity_logo_versions').insert({ proposal_id: p.id, version_number: 1 });
  if (vErr) return fail('Proposta criada, mas a V1 falhou. A migration 0003 foi aplicada?');
  await logIdentity(supabase, { projectId: stage.project_id, stageId, actorType: 'admin', action: 'new_version', detail: `Logo: ${p.label} criada (V1)` });
  refresh();
  return { ok: true };
}

export async function updateLogoProposal(proposalId: string, label: string, description: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (!label.trim()) return fail('Dê um nome à proposta.');
  const { error } = await supabase.from('identity_logo_proposals').update({ label: label.trim().slice(0, 80), description: description.slice(0, 1000) }).eq('id', proposalId);
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

/** Cria a versão N+1 da proposta, copiando os arquivos da base. As versões antigas nunca são alteradas. */
async function newLogoVersion(proposalId: string, opts: { baseVersionId?: string; changes: string; internalNotes: string; date?: string }): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: proposal } = await supabase.from('identity_logo_proposals').select('id, stage_id, label').eq('id', proposalId).maybeSingle();
  if (!proposal) return fail('Proposta não encontrada.');
  const { data: stageRow } = await supabase.from('identity_stages').select('*').eq('id', proposal.stage_id).maybeSingle();
  const stage = stageRow as IdentityStage | null;
  if (!stage) return fail('Etapa não encontrada.');

  const { data: versions } = await supabase.from('identity_logo_versions').select('id, version_number').eq('proposal_id', proposalId).order('version_number');
  const list = versions ?? [];
  const latest = list[list.length - 1];
  const base = list.find((v) => v.id === opts.baseVersionId) ?? latest;
  if (!base) return fail('Versão base não encontrada.');
  const next = (latest?.version_number ?? 0) + 1;
  const createdAt = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? `${opts.date}T12:00:00-03:00` : new Date().toISOString();

  const { data: nv, error } = await supabase
    .from('identity_logo_versions')
    .insert({ proposal_id: proposalId, version_number: next, changes: opts.changes.trim().slice(0, 3000), internal_notes: opts.internalNotes.trim().slice(0, 3000), created_at: createdAt })
    .select('id')
    .single();
  if (error || !nv) return fail('Não foi possível criar a nova versão.');

  const { data: assets } = await supabase.from('identity_assets').select('*').eq('logo_version_id', base.id).order('position');
  if (assets?.length) {
    await supabase.from('identity_assets').insert(
      assets.map((a) => ({
        project_id: a.project_id,
        stage_id: a.stage_id,
        version_id: a.version_id,
        proposal_id: proposalId,
        logo_version_id: nv.id,
        slot: a.slot,
        storage_path: a.storage_path,
        file_name: a.file_name,
        mime_type: a.mime_type,
        position: a.position,
      })),
    );
  }
  // a etapa volta a "em criação": o cliente só vê a nova versão quando você reenviar
  if (stage.status !== 'draft') await supabase.from('identity_stages').update({ status: 'draft', approved_at: null, approved_by: null }).eq('id', stage.id);
  await syncProjectStatus(supabase, stage.project_id);
  const restored = base.id !== latest?.id || opts.changes.startsWith('Restaurada');
  await logIdentity(supabase, {
    projectId: stage.project_id,
    stageId: stage.id,
    actorType: 'admin',
    action: restored ? 'restore' : 'new_version',
    detail: restored ? `Logo ${proposal.label}: V${base.version_number} usada novamente como V${next}` : `Logo ${proposal.label}: V${next} adicionada`,
  });
  refresh();
  return { ok: true };
}

export async function createLogoVersion(proposalId: string, input: { changes: string; internalNotes: string; date?: string; baseVersionId?: string }): Promise<ActionResult> {
  return newLogoVersion(proposalId, input);
}

/** Somente ADMIN: "Usar esta versão novamente" cria uma NOVA versão baseada na antiga (nada é excluído). */
export async function restoreLogoVersion(proposalId: string, fromVersionId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: from } = await supabase.from('identity_logo_versions').select('version_number').eq('id', fromVersionId).eq('proposal_id', proposalId).maybeSingle();
  if (!from) return fail('Versão não encontrada.');
  return newLogoVersion(proposalId, { baseVersionId: fromVersionId, changes: `Restaurada a partir da V${from.version_number}.`, internalNotes: '' });
}

export async function updateLogoVersion(logoVersionId: string, changes: string, internalNotes: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('identity_logo_versions').update({ changes: changes.slice(0, 3000), internal_notes: internalNotes.slice(0, 3000) }).eq('id', logoVersionId);
  if (error) return fail('Não foi possível salvar.');
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
  await logIdentity(supabase, { projectId: stage.project_id, stageId, actorType: 'admin', actorName: prof?.name || 'Soltria', action: 'comment', detail: `${STAGE_BY_KEY[stage.stage_key].label}: respondeu no chat` });
  refresh();
  return { ok: true };
}

/** Comentário (com ou sem marcador) em uma imagem — resposta da administradora. */
export async function addAdminAnnotation(input: { assetId: string; x?: number | null; y?: number | null; message: string }): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const text = input.message.trim();
  if (!text) return fail('Escreva o comentário.');
  const { data: asset } = await supabase.from('identity_assets').select('id, project_id, stage_id').eq('id', input.assetId).maybeSingle();
  if (!asset) return fail('Imagem não encontrada.');
  const hasPoint = typeof input.x === 'number' && typeof input.y === 'number';
  let number: number | null = null;
  if (hasPoint) {
    const { count } = await supabase.from('identity_annotations').select('id', { count: 'exact', head: true }).eq('asset_id', asset.id).not('x', 'is', null);
    number = (count ?? 0) + 1;
  }
  const { data: prof } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
  const { error } = await supabase.from('identity_annotations').insert({
    project_id: asset.project_id,
    stage_id: asset.stage_id,
    asset_id: asset.id,
    x: hasPoint ? Math.max(0, Math.min(100, input.x!)) : null,
    y: hasPoint ? Math.max(0, Math.min(100, input.y!)) : null,
    number,
    message: text.slice(0, 2000),
    author_type: 'admin',
    author_name: prof?.name || 'Soltria',
  });
  if (error) return fail('Não foi possível salvar o comentário.');
  refresh();
  return { ok: true };
}

export async function deleteAnnotation(annotationId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('identity_annotations').delete().eq('id', annotationId);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

/** Links de acesso rápido do projeto (pasta do Drive, formulário do Google…). Só a administradora vê. */
export async function saveIdentityLinks(projectId: string, links: QuickLink[]): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  if (links.length > 12) return fail('Máximo de 12 links.');
  const clean: QuickLink[] = [];
  for (const l of links) {
    const url = l.url.trim();
    if (!url && !l.label.trim()) continue;
    let ok = false;
    try {
      const u = new URL(url);
      ok = u.protocol === 'https:' || u.protocol === 'http:';
    } catch {}
    if (!ok) return fail(`O link “${l.label || url || 'sem nome'}” não parece um endereço válido (use https://…).`);
    clean.push({ id: l.id, label: (l.label.trim() || 'Link').slice(0, 80), url: url.slice(0, 1000), kind: l.kind === 'drive' || l.kind === 'form' ? l.kind : 'other' });
  }
  const { error } = await supabase.from('identity_projects').update({ links: clean }).eq('id', projectId);
  if (error) return fail('Não foi possível salvar. A migration 0005 foi aplicada no Supabase? (supabase/migrations/0005_links_identidade.sql)');
  await logIdentity(supabase, { projectId, actorType: 'admin', action: 'links', detail: 'Links de acesso rápido atualizados' });
  refresh();
  return { ok: true };
}
