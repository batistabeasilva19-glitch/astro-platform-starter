import { NextResponse } from 'next/server';
import { resolveToken } from '@/lib/data/portal';
import { releasedReport } from '@/lib/data/perf';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportPdfResponse } from '@/lib/perf/report-export';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** PDF do relatório para o cliente: só relatórios finalizados e liberados pela administradora (sem observações internas). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; month: string }> }) {
  const { token, month } = await params;
  const session = await resolveToken(token);
  if (!session || !/^\d{4}-\d{2}$/.test(month)) return new NextResponse('Link indisponível.', { status: 404 });
  const rep = await releasedReport(createAdminClient(), session.client.id, `${month}-01`);
  if (!rep) return new NextResponse('Relatório não disponível.', { status: 404 });
  const url = new URL(req.url);
  return reportPdfResponse({ data: rep.data, edits: rep.edits, origin: url.origin, inline: url.searchParams.get('inline') === '1' });
}
