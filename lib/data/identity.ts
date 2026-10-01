import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPaths } from '@/lib/storage';
import {
  STAGES,
  STAGE_BY_KEY,
  deriveProjectStatus,
  type IdentityActivity,
  type IdentityAnnotation,
  type IdentityApproval,
  type IdentityAsset,
  type IdentityComment,
  type IdentityDetail,
  type IdentityFavorite,
  type IdentityProject,
  type IdentitySelection,
  type IdentityStage,
  type IdentityVersion,
  type LogoProposal,
  type LogoVersionData,
  type StageData,
  type StageKey,
  type StageStatus,
} from '@/lib/identity/types';

type LogoVersionRow = Omit<LogoVersionData, 'assets'>;

/** Carrega o projeto completo (etapas, versões, propostas de logo, arquivos assinados, comentários, favoritos…). */
export async function fetchIdentityDetail(db: SupabaseClient, projectId: string): Promise<IdentityDetail | null> {
  const { data: project } = await db.from('identity_projects').select('*').eq('id', projectId).maybeSingle();
  if (!project) return null;

  const [stagesRes, assetsRes, commentsRes, approvalsRes, activityRes, favRes, selRes, annRes, dlRes] = await Promise.all([
    db.from('identity_stages').select('*').eq('project_id', projectId),
    db.from('identity_assets').select('*').eq('project_id', projectId).order('position'),
    db.from('identity_comments').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_approvals').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_activity').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_favorites').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_selections').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_annotations').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_downloads').select('asset_id').eq('project_id', projectId),
  ]);

  const stages = (stagesRes.data ?? []) as IdentityStage[];
  const stageIds = stages.map((s) => s.id);
  const [versionsRes, proposalsRes] = stageIds.length
    ? await Promise.all([
        db.from('identity_versions').select('*').in('stage_id', stageIds).order('version_number'),
        db.from('identity_logo_proposals').select('*').in('stage_id', stageIds).order('position'),
      ])
    : [{ data: [] }, { data: [] }];
  const proposals = (proposalsRes.data ?? []) as LogoProposal[];
  const { data: logoVersionRows } = proposals.length
    ? await db.from('identity_logo_versions').select('*').in('proposal_id', proposals.map((p) => p.id)).order('version_number')
    : { data: [] as LogoVersionRow[] };

  const assets = (assetsRes.data ?? []) as IdentityAsset[];
  const signed = await signPaths(assets.map((a) => a.storage_path));
  const withUrl = (a: IdentityAsset) => ({ ...a, url: signed[a.storage_path] ?? '' });

  const versions = (versionsRes.data ?? []) as IdentityVersion[];
  const comments = (commentsRes.data ?? []) as IdentityComment[];
  const approvals = (approvalsRes.data ?? []) as IdentityApproval[];
  const logoVersions = (logoVersionRows ?? []) as LogoVersionRow[];

  const order = new Map(STAGES.map((s, i) => [s.key, i]));
  const stageData: StageData[] = stages
    .map((st) => ({
      ...st,
      versions: versions
        .filter((v) => v.stage_id === st.id)
        .map((v) => ({ ...v, assets: assets.filter((a) => a.version_id === v.id && !a.proposal_id).map(withUrl) })),
      proposals: proposals
        .filter((p) => p.stage_id === st.id)
        .map((p) => ({
          ...p,
          versions: logoVersions
            .filter((lv) => lv.proposal_id === p.id)
            .map((lv) => ({ ...lv, assets: assets.filter((a) => a.logo_version_id === lv.id).map(withUrl) })),
        })),
      comments: comments.filter((c) => c.stage_id === st.id),
      approvals: approvals.filter((a) => a.stage_id === st.id),
    }))
    .sort((a, b) => (order.get(a.stage_key) ?? 0) - (order.get(b.stage_key) ?? 0));

  const downloads: Record<string, number> = {};
  for (const d of (dlRes.data ?? []) as { asset_id: string | null }[]) if (d.asset_id) downloads[d.asset_id] = (downloads[d.asset_id] ?? 0) + 1;

  return {
    project: project as IdentityProject,
    stages: stageData,
    activity: (activityRes.data ?? []) as IdentityActivity[],
    favorites: (favRes.data ?? []) as IdentityFavorite[],
    selections: (selRes.data ?? []) as IdentitySelection[],
    annotations: (annRes.data ?? []) as IdentityAnnotation[],
    downloads,
  };
}

type StageRow = { id: string; stage_key: StageKey; enabled: boolean; status: StageStatus };

/**
 * Mantém o status do projeto sincronizado com as etapas e libera a APROVAÇÃO FINAL sozinha:
 * quando todas as outras etapas ativas estão aprovadas, a etapa final fica "aguardando" o cliente;
 * se alguma deixar de estar aprovada, a final volta para "em criação".
 */
export async function syncProjectStatus(db: SupabaseClient, projectId: string) {
  const [{ data: project }, { data: rows }] = await Promise.all([
    db.from('identity_projects').select('status').eq('id', projectId).maybeSingle(),
    db.from('identity_stages').select('id, stage_key, enabled, status').eq('project_id', projectId),
  ]);
  if (!project) return;
  const stages = (rows ?? []) as StageRow[];

  const final = stages.find((s) => s.stage_key === 'final' && s.enabled);
  const required = stages.filter((s) => s.enabled && s.stage_key !== 'final' && STAGE_BY_KEY[s.stage_key].approvable);
  const allDone = required.length > 0 && required.every((s) => s.status === 'approved');
  if (final) {
    if (allDone && final.status === 'draft') {
      await db.from('identity_stages').update({ status: 'awaiting', sent_at: new Date().toISOString() }).eq('id', final.id);
      final.status = 'awaiting';
      await logIdentity(db, { projectId, stageId: final.id, actorType: 'system', action: 'sent', detail: 'Aprovação final liberada: todas as etapas foram aprovadas' });
    } else if (!allDone && (final.status === 'awaiting' || final.status === 'approved')) {
      await db.from('identity_stages').update({ status: 'draft', approved_at: null, approved_by: null }).eq('id', final.id);
      final.status = 'draft';
    }
  }
  await db.from('identity_projects').update({ status: deriveProjectStatus(project.status, stages) }).eq('id', projectId);
}

export async function logIdentity(
  db: SupabaseClient,
  e: { projectId: string; stageId?: string | null; actorType: 'admin' | 'client' | 'system'; actorName?: string; action: string; detail: string },
) {
  await db.from('identity_activity').insert({
    project_id: e.projectId,
    stage_id: e.stageId ?? null,
    actor_type: e.actorType,
    actor_name: e.actorName ?? '',
    action: e.action,
    detail: e.detail,
  });
}
