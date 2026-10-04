import 'server-only';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/** O que o cliente faz e a administradora quer ficar sabendo. */
export type NotifKind = 'approved' | 'changes' | 'comment' | 'other';
export interface Notif {
  id: string;
  at: string;
  kind: NotifKind;
  who: string;
  client: string;
  what: string;
  detail: string;
  href: string;
}

const RELEVANT = ['approved', 'changes_requested', 'comment', 'plan', 'story', 'annotation', 'chosen', 'selection', 'briefing'];
const SEEN_COOKIE = 'notif_seen';

export const kindOf = (action: string, detail: string): NotifKind => {
  if (action === 'approved') return 'approved';
  if (action === 'changes_requested' || /pediu ajuste/i.test(detail)) return 'changes';
  if (action === 'comment' || action === 'annotation' || /comentou/i.test(detail)) return 'comment';
  if (/aprovou/i.test(detail)) return 'approved';
  return 'other';
};

/** Quando a administradora viu as notificações pela última vez (neste navegador). Sem registro: últimos 7 dias. */
export async function lastSeen(): Promise<string> {
  const v = (await cookies()).get(SEEN_COOKIE)?.value;
  if (v && !Number.isNaN(Date.parse(v))) return v;
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

/** Quantas novidades do cliente desde a última visita. */
export async function unreadCount(db: SupabaseClient): Promise<number> {
  const since = await lastSeen();
  const [a, b] = await Promise.all([
    db.from('activity_logs').select('id', { count: 'exact', head: true }).eq('actor_type', 'client').in('action', RELEVANT).gt('created_at', since),
    db.from('identity_activity').select('id', { count: 'exact', head: true }).eq('actor_type', 'client').in('action', RELEVANT).gt('created_at', since),
  ]);
  return (a.error ? 0 : (a.count ?? 0)) + (b.error ? 0 : (b.count ?? 0));
}

/** Lista unificada (conteúdos + identidade visual), da mais nova para a mais antiga. */
export async function fetchNotifications(db: SupabaseClient, limit = 80): Promise<Notif[]> {
  const [a, b] = await Promise.all([
    db.from('activity_logs').select('id, client_id, content_id, actor_name, action, detail, created_at').eq('actor_type', 'client').in('action', RELEVANT).order('created_at', { ascending: false }).limit(limit),
    db.from('identity_activity').select('id, project_id, stage_id, actor_name, action, detail, created_at').eq('actor_type', 'client').in('action', RELEVANT).order('created_at', { ascending: false }).limit(limit),
  ]);
  const acts = a.error ? [] : (a.data ?? []);
  const ids = b.error ? [] : (b.data ?? []);

  const clientIds = [...new Set(acts.map((x) => x.client_id as string))];
  const contentIds = [...new Set(acts.map((x) => x.content_id as string | null).filter((x): x is string => !!x))];
  const projectIds = [...new Set(ids.map((x) => x.project_id as string))];
  const stageIds = [...new Set(ids.map((x) => x.stage_id as string | null).filter((x): x is string => !!x))];

  const [clients, contents, projects, stages] = await Promise.all([
    clientIds.length ? db.from('clients').select('id, company_name').in('id', clientIds) : { data: [] },
    contentIds.length ? db.from('content_items').select('id, title').in('id', contentIds) : { data: [] },
    projectIds.length ? db.from('identity_projects').select('id, name, client_id').in('id', projectIds) : { data: [] },
    stageIds.length ? db.from('identity_stages').select('id, stage_key').in('id', stageIds) : { data: [] },
  ]);
  const projClientIds = [...new Set((projects.data ?? []).map((p) => p.client_id as string))].filter((i) => !clientIds.includes(i));
  const more = projClientIds.length ? await db.from('clients').select('id, company_name').in('id', projClientIds) : { data: [] };

  const cName = new Map([...(clients.data ?? []), ...(more.data ?? [])].map((c) => [c.id as string, c.company_name as string]));
  const title = new Map((contents.data ?? []).map((c) => [c.id as string, c.title as string]));
  const proj = new Map((projects.data ?? []).map((p) => [p.id as string, p as { id: string; name: string; client_id: string }]));
  const stageKey = new Map((stages.data ?? []).map((s) => [s.id as string, s.stage_key as string]));

  const out: Notif[] = [
    ...acts.map((x): Notif => {
      const cid = x.client_id as string;
      const content = x.content_id as string | null;
      const planLike = x.action === 'plan' || x.action === 'story';
      return {
        id: `a-${x.id}`,
        at: x.created_at as string,
        kind: kindOf(x.action as string, x.detail as string),
        who: (x.actor_name as string) || 'Cliente',
        client: cName.get(cid) ?? 'Cliente',
        what: content ? (title.get(content) ?? 'Conteúdo') : planLike ? (x.action === 'story' ? 'Stories' : 'Calendário do mês') : x.action === 'briefing' ? 'Formulário' : 'Perfil',
        detail: x.detail as string,
        href: content ? `/admin/content/${content}` : planLike ? `/admin/clients/${cid}/cronograma?aba=${x.action === 'story' ? 'stories' : 'mes'}` : `/admin/clients/${cid}`,
      };
    }),
    ...ids.map((x): Notif => {
      const p = proj.get(x.project_id as string);
      const sk = x.stage_id ? stageKey.get(x.stage_id as string) : null;
      return {
        id: `i-${x.id}`,
        at: x.created_at as string,
        kind: kindOf(x.action as string, x.detail as string),
        who: (x.actor_name as string) || 'Cliente',
        client: p ? (cName.get(p.client_id) ?? 'Cliente') : 'Cliente',
        what: p ? `Identidade visual · ${p.name}` : 'Identidade visual',
        detail: x.detail as string,
        href: p ? `/admin/identidades/${p.id}${sk ? `?etapa=${sk}` : ''}` : '/admin/identidades',
      };
    }),
  ];
  return out.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
}
