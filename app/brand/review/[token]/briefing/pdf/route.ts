import { NextResponse } from 'next/server';
import { identityPortalDetail, resolveIdentityToken } from '@/lib/data/identity-portal';
import { briefingPdfResponse } from '@/lib/identity/briefing-export';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** O cliente baixa uma cópia do próprio formulário (valida o token do link). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveIdentityToken(token);
  if (!session) return new NextResponse('Link indisponível.', { status: 404 });
  const detail = await identityPortalDetail(session);
  const stage = detail?.stages.find((s) => s.stage_key === 'briefing');
  if (!detail || !stage || stage.versions.length === 0) return new NextResponse('Formulário não disponível.', { status: 404 });
  return briefingPdfResponse({ detail, clientName: session.client.company_name, origin: new URL(req.url).origin });
}
