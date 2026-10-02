'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveToken } from '@/lib/data/portal';
import { removeFiles } from '@/lib/storage';
import { MEDIA_BUCKET } from '@/lib/constants';
import { FILE_GROUPS, filesOf, type SocialFile } from '@/lib/social-form/questions';
import { fail, type ActionResult } from './shared';

/**
 * Arquivos do formulário de perfil (logo, fotos, referências…) — ações do CLIENTE, só pelo token do link.
 * Ficam guardados dentro das respostas (`answers.__files`); o arquivo vai direto do celular para o Storage.
 */
const MAX_FILES = 80;
const MAX_MB = 25;
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'pdf', 'zip', 'ai', 'psd', 'docx', 'xlsx', 'pptx', 'mp4', 'mov'];
const GROUPS = new Set<string>(FILE_GROUPS.map((g) => g.id));

async function ctx(token: string) {
  const session = await resolveToken(token);
  if (!session) return { ok: false, error: 'Este link não está mais ativo. Peça um novo link para a Soltria.' } as const;
  const db = createAdminClient();
  const { data } = await db.from('client_social_forms').select('id, status, answers').eq('client_id', session.client.id).maybeSingle();
  if (!data) return { ok: false, error: 'O formulário ainda não está disponível.' } as const;
  if (data.status !== 'open') return { ok: false, error: 'O formulário já foi enviado e está travado. Fale com a Soltria para liberar a edição.' } as const;
  const prefix = `${session.client.owner_id}/${session.client.id}/social-form/`;
  return { ok: true, session, db, form: data as { id: string; answers: Record<string, unknown> }, prefix } as const;
}

async function writeFiles(c: Exclude<Awaited<ReturnType<typeof ctx>>, { ok: false }>, files: SocialFile[]) {
  // lê de novo logo antes de gravar: não sobrescreve respostas salvas enquanto o envio acontecia
  const { data } = await c.db.from('client_social_forms').select('answers').eq('id', c.form.id).maybeSingle();
  const answers = { ...((data?.answers as Record<string, unknown>) ?? {}), __files: files };
  const { error } = await c.db.from('client_social_forms').update({ answers }).eq('id', c.form.id);
  revalidatePath('/admin', 'layout');
  return !error;
}

export async function createSocialUpload(token: string, input: { fileName: string; mime: string; size: number }): Promise<ActionResult<{ path: string; uploadToken: string }>> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  if (input.size > MAX_MB * 1024 * 1024) return fail(`O arquivo deve ter até ${MAX_MB} MB. Para arquivos maiores, coloque o link do Drive na lista de links.`);
  const ext = (input.fileName.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ALLOWED_EXT.includes(ext)) return fail('Formato não aceito. Use imagem, PDF, ZIP, vídeo (MP4/MOV) ou documento.');
  if (filesOf(c.form.answers).length >= MAX_FILES) return fail(`Limite de ${MAX_FILES} arquivos atingido.`);
  const path = `${c.prefix}${randomUUID()}.${ext}`;
  const { data, error } = await c.db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail('Não foi possível iniciar o envio. Tente novamente.');
  return { ok: true, path, uploadToken: data.token };
}

export async function registerSocialFile(token: string, input: { path: string; fileName: string; mime: string; group: string }): Promise<ActionResult> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  if (!input.path.startsWith(c.prefix) || input.path.includes('..')) return fail('Arquivo inválido.');
  const files = filesOf(c.form.answers);
  if (files.some((f) => f.path === input.path)) return { ok: true };
  files.push({ id: randomUUID(), path: input.path, name: input.fileName.slice(0, 200), mime: input.mime.slice(0, 100), group: (GROUPS.has(input.group) ? input.group : 'other') as SocialFile['group'], caption: '' });
  return (await writeFiles(c, files)) ? { ok: true } : fail('Arquivo enviado, mas não foi possível registrá-lo.');
}

export async function removeSocialFile(token: string, id: string): Promise<ActionResult> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  const files = filesOf(c.form.answers);
  const f = files.find((x) => x.id === id);
  if (!f) return fail('Arquivo não encontrado.');
  if (!(await writeFiles(c, files.filter((x) => x.id !== id)))) return fail('Não foi possível remover.');
  await removeFiles([f.path]);
  return { ok: true };
}

export async function setSocialFileCaption(token: string, id: string, caption: string): Promise<ActionResult> {
  const c = await ctx(token);
  if (!c.ok) return fail(c.error);
  const files = filesOf(c.form.answers).map((f) => (f.id === id ? { ...f, caption: caption.slice(0, 300) } : f));
  return (await writeFiles(c, files)) ? { ok: true } : fail('Não foi possível salvar.');
}
