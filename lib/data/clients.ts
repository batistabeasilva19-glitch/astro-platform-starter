import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { signPaths } from '@/lib/storage';
import type { Client, ClientWithProject, Project } from '@/lib/types';

/**
 * Garante sessão da administradora; senão manda para /login.
 * Usa getClaims(): valida o JWT localmente (sem ir ao servidor de Auth a cada página).
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect('/login');
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/** Garante a linha em `users` (caso o login tenha sido criado antes da migration). */
export async function ensureProfile(user: { id: string; email: string | null }) {
  const supabase = await createClient();
  await supabase.from('users').upsert({ id: user.id, email: user.email }, { onConflict: 'id', ignoreDuplicates: true });
}

async function withProjects(rows: Client[]): Promise<ClientWithProject[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .in('client_id', rows.map((r) => r.id));
  const signed = await signPaths(rows.map((r) => r.avatar_path));
  return rows.map((c) => ({
    ...c,
    project: ((projects ?? []) as Project[]).find((p) => p.client_id === c.id) ?? null,
    avatar_url: c.avatar_path ? (signed[c.avatar_path] ?? null) : null,
  }));
}

export async function listClients(): Promise<ClientWithProject[]> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('*').order('company_name');
  return withProjects((data ?? []) as Client[]);
}

export async function getClient(id: string): Promise<ClientWithProject | null> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  return (await withProjects([data as Client]))[0];
}
