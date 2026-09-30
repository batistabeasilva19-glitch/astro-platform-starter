import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { signOne } from '@/lib/storage';
import { CLIENT_VISIBLE } from '@/lib/constants';
import { fetchCards, fetchDetail, fetchFeed } from '@/lib/data/content';
import type { Client, ContentCardData, ContentDetail, Project } from '@/lib/types';

export interface PortalSession {
  project: Project;
  client: Client;
  avatarUrl: string | null;
  /** Nome que assina as aprovações. */
  signerName: string;
}

/**
 * Valida o token do link. Retorna null se não existir ou se o link foi revogado.
 * É a ÚNICA porta de entrada do portal do cliente.
 */
export const resolveToken = cache(async (token: string): Promise<PortalSession | null> => {
  if (!token || token.length < 20 || token.length > 200) return null;
  const db = createAdminClient();
  const { data: project } = await db
    .from('projects')
    .select('*')
    .eq('review_token', token)
    .eq('token_active', true)
    .maybeSingle();
  if (!project) return null;
  const { data: client } = await db.from('clients').select('*').eq('id', project.client_id).maybeSingle();
  if (!client) return null;
  return {
    project: project as Project,
    client: client as Client,
    avatarUrl: await signOne((client as Client).avatar_path),
    signerName: (client as Client).contact_name || (client as Client).company_name,
  };
});

// ─── Dados do portal (sem campos internos) ────────────────────────────────

const CLIENT_HISTORY = ['created', 'sent', 'approved', 'changes_requested', 'new_version', 'comment'];

/** Remove o que o cliente nunca deve receber no navegador (observações internas, objetivo). */
function stripCard(c: ContentCardData): ContentCardData {
  return { ...c, internal_notes: '', objective: '' };
}

export async function clientCards(s: PortalSession): Promise<ContentCardData[]> {
  const cards = await fetchCards(createAdminClient(), { clientId: s.client.id, visibleStatuses: CLIENT_VISIBLE });
  return cards.map(stripCard);
}

export async function clientFeed(s: PortalSession) {
  const feed = await fetchFeed(createAdminClient(), s.client.id, CLIENT_VISIBLE);
  return { ...feed, grid: feed.grid.map(stripCard), stories: feed.stories.map(stripCard) };
}

export async function clientDetail(s: PortalSession, contentId: string): Promise<ContentDetail | null> {
  const d = await fetchDetail(createAdminClient(), contentId);
  if (!d || d.client_id !== s.client.id || !CLIENT_VISIBLE.includes(d.status)) return null;
  return {
    ...d,
    internal_notes: '',
    objective: '',
    history: d.history.filter((h) => CLIENT_HISTORY.includes(h.action)),
  };
}
