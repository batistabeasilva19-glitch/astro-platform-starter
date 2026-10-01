import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signPaths } from '@/lib/storage';
import type { PublicStrategyDoc, StrategyDoc } from '@/lib/strategy';

/** Administradora: todos os PDFs do cliente, com URL assinada para abrir. `missing` = migration 0006 pendente. */
export async function listStrategyDocs(db: SupabaseClient, clientId: string): Promise<{ docs: (StrategyDoc & { url: string })[]; missing: boolean }> {
  const { data, error } = await db.from('strategy_documents').select('*').eq('client_id', clientId).order('month', { ascending: false }).order('created_at', { ascending: false });
  if (error) return { docs: [], missing: true };
  const docs = (data ?? []) as StrategyDoc[];
  const signed = await signPaths(docs.map((d) => d.storage_path));
  return { docs: docs.map((d) => ({ ...d, url: signed[d.storage_path] ?? '' })), missing: false };
}

/** Portal do cliente: só os PDFs marcados como visíveis e SEM caminho do Storage (o acesso passa pelo servidor). */
export async function listPublicStrategyDocs(db: SupabaseClient, clientId: string): Promise<PublicStrategyDoc[]> {
  const { data, error } = await db.from('strategy_documents').select('id, month, title, description, file_name, size_bytes, visible, created_at, updated_at').eq('client_id', clientId).eq('visible', true).order('month', { ascending: false }).order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as PublicStrategyDoc[];
}
