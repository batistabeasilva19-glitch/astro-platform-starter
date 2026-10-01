import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { signOne } from '@/lib/storage';
import { fetchIdentityDetail } from '@/lib/data/identity';
import type { Client } from '@/lib/types';
import type { IdentityDetail, IdentityProject, StageData } from '@/lib/identity/types';

export interface IdentitySession {
  project: IdentityProject;
  client: Client;
  avatarUrl: string | null;
  signerName: string;
}

/** Porta de entrada do portal de Identidade Visual (/brand/review/<token>): valida o token do link. */
export const resolveIdentityToken = cache(async (token: string): Promise<IdentitySession | null> => {
  if (!token || token.length < 20 || token.length > 200) return null;
  const db = createAdminClient();
  const { data: project } = await db.from('identity_projects').select('*').eq('review_token', token).eq('token_active', true).maybeSingle();
  if (!project) return null;
  const { data: client } = await db.from('clients').select('*').eq('id', project.client_id).maybeSingle();
  if (!client) return null;
  return {
    project: project as IdentityProject,
    client: client as Client,
    avatarUrl: await signOne((client as Client).avatar_path),
    signerName: (client as Client).contact_name || (client as Client).company_name,
  };
});

const CLIENT_ACTIONS = ['created', 'sent', 'approved', 'changes_requested', 'new_version', 'comment', 'favorite', 'chosen', 'selection', 'annotation', 'restore', 'download'];

/**
 * Detalhe do projeto para o cliente. NUNCA inclui: observações internas, notas internas de versões,
 * etapas desativadas, conteúdo de etapas em criação, nem arquivos finais não liberados.
 */
export async function identityPortalDetail(s: IdentitySession): Promise<IdentityDetail | null> {
  const d = await fetchIdentityDetail(createAdminClient(), s.project.id);
  if (!d) return null;
  const approvedProject = d.project.status === 'approved' || d.project.status === 'finalized';

  const stages: StageData[] = d.stages
    .filter((st) => st.enabled)
    .map((st) => {
      // etapa em criação: nada do conteúdo é enviado ao navegador do cliente
      if (st.status === 'draft' && st.stage_key !== 'files') return { ...st, versions: [], proposals: [] };
      if (st.stage_key === 'files') {
        // Arquivos finais: só depois da aprovação e só os liberados pela administradora
        if (!approvedProject) return { ...st, versions: [] };
        return { ...st, versions: st.versions.map((v) => ({ ...v, assets: v.assets.filter((a) => a.released) })) };
      }
      return {
        ...st,
        proposals: st.proposals.map((p) => ({ ...p, versions: p.versions.map((v) => ({ ...v, internal_notes: '' })) })),
      };
    });

  const visibleAssetIds = new Set<string>();
  for (const st of stages) {
    for (const v of st.versions) v.assets.forEach((a) => visibleAssetIds.add(a.id));
    for (const p of st.proposals) for (const v of p.versions) v.assets.forEach((a) => visibleAssetIds.add(a.id));
  }
  const visibleStageIds = new Set(stages.map((st) => st.id));

  return {
    project: { ...d.project, internal_notes: '', review_token: '' },
    stages,
    activity: d.activity.filter((a) => CLIENT_ACTIONS.includes(a.action)),
    favorites: d.favorites,
    selections: d.selections.filter((x) => !x.stage_id || visibleStageIds.has(x.stage_id)),
    annotations: d.annotations.filter((a) => visibleAssetIds.has(a.asset_id)),
    downloads: {},
  };
}

/** Dados leves para o menu do portal (sem assinar arquivos). */
export async function portalNav(s: IdentitySession) {
  const db = createAdminClient();
  const { data } = await db.from('identity_stages').select('stage_key, enabled, status').eq('project_id', s.project.id);
  return (data ?? []).filter((x) => x.enabled) as { stage_key: StageData['stage_key']; enabled: boolean; status: StageData['status'] }[];
}
