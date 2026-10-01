import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPaths } from '@/lib/storage';

export interface ProfileShot {
  id: string;
  caption: string;
  taken_on: string | null;
  created_at: string;
  url: string;
}

/** Prints do perfil (antes). Uso EXCLUSIVO do painel da administradora. `missing` = migration 0009 pendente. */
export async function listProfileShots(db: SupabaseClient, clientId: string): Promise<{ shots: ProfileShot[]; missing: boolean }> {
  const { data, error } = await db.from('client_profile_shots').select('id, storage_path, caption, taken_on, created_at').eq('client_id', clientId).eq('kind', 'before').order('created_at', { ascending: false });
  if (error) return { shots: [], missing: true };
  const rows = data ?? [];
  const signed = await signPaths(rows.map((r) => r.storage_path));
  return { shots: rows.map((r) => ({ id: r.id, caption: r.caption, taken_on: r.taken_on, created_at: r.created_at, url: signed[r.storage_path] ?? '' })), missing: false };
}
