import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { MEDIA_BUCKET, SIGNED_URL_TTL } from '@/lib/constants';

/**
 * Gera URLs assinadas (temporárias) para caminhos do bucket privado "media".
 * Roda só no servidor, com service role — o navegador nunca vê a chave.
 */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return {};
  const { data, error } = await createAdminClient()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

export async function signOne(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return (await signPaths([path]))[path] ?? null;
}

/** Remove arquivos do Storage (ignora erros — limpeza "best effort"). */
export async function removeFiles(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;
  await createAdminClient().storage.from(MEDIA_BUCKET).remove(unique);
}
