import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { signPaths } from '@/lib/storage';
import type { Client, ClientWithProject } from '@/lib/types';
import type { IdentityProject, IdentityStage } from '@/lib/identity/types';

export interface IdentityListItem extends IdentityProject {
  client: Pick<Client, 'id' | 'company_name' | 'contact_name'> & { avatar_url: string | null };
  stages: Pick<IdentityStage, 'stage_key' | 'enabled' | 'status'>[];
}

/** Lista os projetos de identidade visual da administradora, com cliente e resumo das etapas. */
export async function listIdentities(): Promise<IdentityListItem[]> {
  await requireUser();
  const supabase = await createClient();
  const { data: projects } = await supabase.from('identity_projects').select('*').order('updated_at', { ascending: false });
  const list = (projects ?? []) as IdentityProject[];
  if (!list.length) return [];

  const clientIds = [...new Set(list.map((p) => p.client_id))];
  const [{ data: clients }, { data: stages }] = await Promise.all([
    supabase.from('clients').select('id, company_name, contact_name, avatar_path').in('id', clientIds),
    supabase.from('identity_stages').select('project_id, stage_key, enabled, status').in('project_id', list.map((p) => p.id)),
  ]);
  const signed = await signPaths((clients ?? []).map((c) => c.avatar_path));

  return list.map((p) => {
    const c = (clients ?? []).find((x) => x.id === p.client_id);
    return {
      ...p,
      client: {
        id: p.client_id,
        company_name: c?.company_name ?? 'Cliente',
        contact_name: c?.contact_name ?? '',
        avatar_url: c?.avatar_path ? (signed[c.avatar_path] ?? null) : null,
      },
      stages: (stages ?? []).filter((s) => s.project_id === p.id),
    };
  });
}

export type { ClientWithProject };
