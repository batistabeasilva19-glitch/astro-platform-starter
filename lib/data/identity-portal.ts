import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { signOne } from '@/lib/storage';
import { fetchIdentityDetail } from '@/lib/data/identity';
import type { Client } from '@/lib/types';
import type { IdentityDetail, IdentityProject } from '@/lib/identity/types';

export interface IdentitySession {
  project: IdentityProject;
  client: Client;
  avatarUrl: string | null;
  signerName: string;
}

/** Porta de entrada do portal de Identidade Visual: valida o token do link. */
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

const CLIENT_ACTIONS = ['created', 'sent', 'approved', 'changes_requested', 'new_version', 'comment', 'favorite', 'chosen'];

/** Detalhe do projeto para o cliente: sem observações internas, sem etapas desativadas e sem rascunhos. */
export async function identityPortalDetail(s: IdentitySession): Promise<IdentityDetail | null> {
  const d = await fetchIdentityDetail(createAdminClient(), s.project.id);
  if (!d) return null;
  return {
    project: { ...d.project, internal_notes: '', review_token: '' },
    stages: d.stages
      .filter((st) => st.enabled)
      // etapa em criação: o conteúdo não é enviado ao navegador do cliente
      .map((st) => (st.status === 'draft' ? { ...st, versions: [] } : st)),
    activity: d.activity.filter((a) => CLIENT_ACTIONS.includes(a.action)),
  };
}
