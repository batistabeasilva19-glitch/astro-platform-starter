import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPaths } from '@/lib/storage';
import {
  deriveProjectStatus,
  type IdentityActivity,
  type IdentityApproval,
  type IdentityAsset,
  type IdentityComment,
  type IdentityDetail,
  type IdentityProject,
  type IdentityStage,
  type IdentityVersion,
  type LogoProposal,
  type StageData,
  STAGES,
} from '@/lib/identity/types';

/** Carrega o projeto completo (etapas, versões, arquivos assinados, comentários, histórico). */
export async function fetchIdentityDetail(db: SupabaseClient, projectId: string): Promise<IdentityDetail | null> {
  const { data: project } = await db.from('identity_projects').select('*').eq('id', projectId).maybeSingle();
  if (!project) return null;

  const [stagesRes, assetsRes, commentsRes, approvalsRes, activityRes] = await Promise.all([
    db.from('identity_stages').select('*').eq('project_id', projectId),
    db.from('identity_assets').select('*').eq('project_id', projectId).order('position'),
    db.from('identity_comments').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_approvals').select('*').eq('project_id', projectId).order('created_at'),
    db.from('identity_activity').select('*').eq('project_id', projectId).order('created_at'),
  ]);

  const stages = (stagesRes.data ?? []) as IdentityStage[];
  const stageIds = stages.map((s) => s.id);
  const [versionsRes, proposalsRes] = stageIds.length
    ? await Promise.all([
        db.from('identity_versions').select('*').in('stage_id', stageIds).order('version_number'),
        db.from('identity_logo_proposals').select('*').in('stage_id', stageIds).order('position'),
      ])
    : [{ data: [] }, { data: [] }];

  const assets = (assetsRes.data ?? []) as IdentityAsset[];
  const signed = await signPaths(assets.map((a) => a.storage_path));
  const withUrl = (a: IdentityAsset) => ({ ...a, url: signed[a.storage_path] ?? '' });

  const versions = (versionsRes.data ?? []) as IdentityVersion[];
  const proposals = (proposalsRes.data ?? []) as LogoProposal[];
  const comments = (commentsRes.data ?? []) as IdentityComment[];
  const approvals = (approvalsRes.data ?? []) as IdentityApproval[];

  const order = new Map(STAGES.map((s, i) => [s.key, i]));
  const stageData: StageData[] = stages
    .map((st) => ({
      ...st,
      versions: versions
        .filter((v) => v.stage_id === st.id)
        .map((v) => ({
          ...v,
          assets: assets.filter((a) => a.version_id === v.id && !a.proposal_id).map(withUrl),
          proposals: proposals
            .filter((p) => p.version_id === v.id)
            .map((p) => ({ ...p, assets: assets.filter((a) => a.proposal_id === p.id).map(withUrl) })),
        })),
      comments: comments.filter((c) => c.stage_id === st.id),
      approvals: approvals.filter((a) => a.stage_id === st.id),
    }))
    .sort((a, b) => (order.get(a.stage_key) ?? 0) - (order.get(b.stage_key) ?? 0));

  return { project: project as IdentityProject, stages: stageData, activity: (activityRes.data ?? []) as IdentityActivity[] };
}

/** Recalcula o status do projeto a partir das etapas (exceto "finalizado", que é manual). */
export async function syncProjectStatus(db: SupabaseClient, projectId: string) {
  const [{ data: project }, { data: stages }] = await Promise.all([
    db.from('identity_projects').select('status').eq('id', projectId).maybeSingle(),
    db.from('identity_stages').select('stage_key, enabled, status').eq('project_id', projectId),
  ]);
  if (!project) return;
  const next = deriveProjectStatus(project.status, (stages ?? []) as never[]);
  await db.from('identity_projects').update({ status: next }).eq('id', projectId);
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
