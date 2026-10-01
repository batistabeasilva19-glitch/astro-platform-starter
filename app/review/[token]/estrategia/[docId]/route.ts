import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveToken } from '@/lib/data/portal';
import { MEDIA_BUCKET } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Abre ou baixa um PDF de estratégia: valida o token do link, confere que o documento é daquele
 * cliente e está visível, e redireciona para uma URL assinada temporária. O caminho do Storage
 * nunca é exposto ao navegador do cliente.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const session = await resolveToken(token);
  if (!session) return new NextResponse('Link indisponível.', { status: 404 });
  const db = createAdminClient();
  const { data: doc } = await db.from('strategy_documents').select('storage_path, file_name, title, visible').eq('id', docId).eq('client_id', session.client.id).maybeSingle();
  if (!doc || !doc.visible) return new NextResponse('Documento não disponível.', { status: 404 });

  const download = new URL(req.url).searchParams.get('download') === '1';
  const name = (doc.file_name || `${doc.title}.pdf`).replace(/[^\w.\- ]+/g, '_');
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(doc.storage_path, 300, download ? { download: name } : undefined);
  if (error || !data) return new NextResponse('Não foi possível abrir o documento.', { status: 500 });
  return NextResponse.redirect(data.signedUrl, 302);
}
