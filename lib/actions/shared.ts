import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export async function logActivity(
  db: SupabaseClient,
  entry: {
    clientId: string;
    contentId?: string | null;
    actorType: 'admin' | 'client' | 'system';
    actorName?: string;
    action: string;
    detail?: string;
  },
) {
  await db.from('activity_logs').insert({
    client_id: entry.clientId,
    content_id: entry.contentId ?? null,
    actor_type: entry.actorType,
    actor_name: entry.actorName ?? '',
    action: entry.action,
    detail: entry.detail ?? '',
  });
}
