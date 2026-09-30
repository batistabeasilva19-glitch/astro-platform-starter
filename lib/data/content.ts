import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPaths } from '@/lib/storage';
import type {
  ActivityLog,
  ApprovalRow,
  CommentRow,
  ContentCardData,
  ContentDetail,
  ContentItem,
  ContentMedia,
  ContentVersion,
  VersionWithMedia,
} from '@/lib/types';

export interface ContentFilters {
  clientId?: string;
  statuses?: string[];
  formats?: string[];
  from?: string; // YYYY-MM-DD
  to?: string;
  visibleStatuses?: string[]; // portal: esconde rascunhos
  excludeFormats?: string[];
}

/** Ordena por data/hora de publicação (itens sem data ficam no fim). */
export function byScheduleAsc(a: ContentItem, b: ContentItem) {
  const ka = `${a.scheduled_date ?? '9999-99-99'} ${a.scheduled_time ?? '99:99'}`;
  const kb = `${b.scheduled_date ?? '9999-99-99'} ${b.scheduled_time ?? '99:99'}`;
  return ka.localeCompare(kb);
}

/** Converte itens em cards com miniatura assinada (mídias da versão atual). */
export async function toCards(db: SupabaseClient, items: ContentItem[]): Promise<ContentCardData[]> {
  if (!items.length) return [];
  const ids = items.map((i) => i.id);
  const [{ data: versions }, { data: media }] = await Promise.all([
    db.from('content_versions').select('id, content_id, version_number').in('content_id', ids),
    db
      .from('content_media')
      .select('*')
      .in('content_id', ids)
      .order('position', { ascending: true }),
  ]);

  const currentVersionId = new Map<string, string>();
  for (const item of items) {
    const v = (versions ?? []).find(
      (x) => x.content_id === item.id && x.version_number === item.current_version,
    );
    if (v) currentVersionId.set(item.id, v.id);
  }

  const mediaByItem = new Map<string, ContentMedia[]>();
  for (const m of (media ?? []) as ContentMedia[]) {
    if (currentVersionId.get(m.content_id) !== m.version_id) continue;
    const arr = mediaByItem.get(m.content_id) ?? [];
    arr.push(m);
    mediaByItem.set(m.content_id, arr);
  }

  const thumbPath = (item: ContentItem): string | null => {
    const list = mediaByItem.get(item.id) ?? [];
    if (item.format === 'reel' || item.format === 'video') {
      return list.find((m) => m.kind === 'cover')?.storage_path ?? null;
    }
    return list.find((m) => m.kind === 'image')?.storage_path ?? null;
  };

  const signed = await signPaths(items.map(thumbPath));
  return items.map((item) => {
    const list = mediaByItem.get(item.id) ?? [];
    const p = thumbPath(item);
    return {
      ...item,
      thumb: p ? (signed[p] ?? null) : null,
      slide_count: list.filter((m) => m.kind === 'image').length,
      has_video: list.some((m) => m.kind === 'video'),
    };
  });
}

export async function fetchCards(db: SupabaseClient, f: ContentFilters = {}): Promise<ContentCardData[]> {
  let q = db.from('content_items').select('*');
  if (f.clientId) q = q.eq('client_id', f.clientId);
  const statuses = f.statuses?.length ? f.statuses : f.visibleStatuses;
  if (statuses?.length) q = q.in('status', statuses);
  if (f.formats?.length) q = q.in('format', f.formats);
  if (f.from) q = q.gte('scheduled_date', f.from);
  if (f.to) q = q.lte('scheduled_date', f.to);
  const { data } = await q;
  let items = (data ?? []) as ContentItem[];
  if (f.excludeFormats?.length) items = items.filter((i) => !f.excludeFormats!.includes(i.format));
  items.sort(byScheduleAsc);
  return toCards(db, items);
}

/** Detalhe completo: versões (com mídias assinadas), comentários, aprovações e histórico. */
export async function fetchDetail(db: SupabaseClient, contentId: string): Promise<ContentDetail | null> {
  const { data: item } = await db.from('content_items').select('*').eq('id', contentId).maybeSingle();
  if (!item) return null;

  const [versionsRes, mediaRes, commentsRes, approvalsRes, historyRes] = await Promise.all([
    db.from('content_versions').select('*').eq('content_id', contentId).order('version_number'),
    db.from('content_media').select('*').eq('content_id', contentId).order('position'),
    db.from('comments').select('*').eq('content_id', contentId).order('created_at'),
    db.from('approvals').select('*').eq('content_id', contentId).order('created_at'),
    db.from('activity_logs').select('*').eq('content_id', contentId).order('created_at'),
  ]);

  const media = (mediaRes.data ?? []) as ContentMedia[];
  const signed = await signPaths(media.map((m) => m.storage_path));

  const versions: VersionWithMedia[] = ((versionsRes.data ?? []) as ContentVersion[]).map((v) => ({
    ...v,
    media: media
      .filter((m) => m.version_id === v.id)
      .map((m) => ({ ...m, url: signed[m.storage_path] ?? '' })),
  }));

  return {
    ...(item as ContentItem),
    versions,
    comments: (commentsRes.data ?? []) as CommentRow[],
    approvals: (approvalsRes.data ?? []) as ApprovalRow[],
    history: (historyRes.data ?? []) as ActivityLog[],
  };
}

/**
 * Itens do grid do feed (sem Stories), na ordem do layout salvo.
 * Sem layout: mais recente primeiro (como no Instagram).
 */
export async function fetchFeed(db: SupabaseClient, clientId: string, visibleStatuses?: string[]) {
  const [cards, layoutRes] = await Promise.all([
    fetchCards(db, { clientId, visibleStatuses }),
    db.from('feed_layouts').select('item_order').eq('client_id', clientId).maybeSingle(),
  ]);
  const grid = cards.filter((c) => c.format !== 'story').reverse();
  const stories = cards.filter((c) => c.format === 'story');
  const saved: string[] = layoutRes.data?.item_order ?? [];
  if (!saved.length) return { grid, stories, hasLayout: false };

  const byId = new Map(grid.map((c) => [c.id, c]));
  const ordered = saved.map((id) => byId.get(id)).filter((c): c is ContentCardData => !!c);
  const inLayout = new Set(ordered.map((c) => c.id));
  const fresh = grid.filter((c) => !inLayout.has(c.id)); // novos conteúdos entram no topo
  return { grid: [...fresh, ...ordered], stories, hasLayout: true };
}
