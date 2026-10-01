import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveIdentityToken } from '@/lib/data/identity-portal';
import { logIdentity } from '@/lib/data/identity';
import { MEDIA_BUCKET } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Download controlado dos arquivos finais: valida o token do link, exige projeto aprovado
 * e arquivo liberado ("Disponibilizar para cliente" ligado), registra o download e
 * redireciona para uma URL assinada temporária. Arquivos de trabalho nunca saem por aqui.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; assetId: string }> }) {
  const { token, assetId } = await params;
  const session = await resolveIdentityToken(token);
  if (!session) return new NextResponse('Link indisponível.', { status: 404 });
  if (session.project.status !== 'approved' && session.project.status !== 'finalized') {
    return new NextResponse('Os arquivos ficam disponíveis depois da aprovação da identidade visual.', { status: 403 });
  }
  const db = createAdminClient();
  const { data: asset } = await db.from('identity_assets').select('id, storage_path, file_name, name, released, stage_id').eq('id', assetId).eq('project_id', session.project.id).maybeSingle();
  if (!asset || !asset.released) return new NextResponse('Arquivo não disponível.', { status: 404 });
  const { data: stage } = await db.from('identity_stages').select('stage_key').eq('id', asset.stage_id).maybeSingle();
  if (stage?.stage_key !== 'files') return new NextResponse('Arquivo não disponível.', { status: 404 });

  const filename = asset.file_name || asset.name || 'arquivo';
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(asset.storage_path, 300, { download: filename });
  if (error || !data) return new NextResponse('Não foi possível gerar o download.', { status: 500 });

  await db.from('identity_downloads').insert({ project_id: session.project.id, asset_id: asset.id, file_name: filename, client_name: session.signerName });
  await logIdentity(db, { projectId: session.project.id, stageId: asset.stage_id, actorType: 'client', actorName: session.signerName, action: 'download', detail: `Cliente baixou “${asset.name || filename}”` });
  return NextResponse.redirect(data.signedUrl, 302);
}
