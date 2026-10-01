import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { getReport, reportData } from '@/lib/data/perf';
import { reportPdfResponse } from '@/lib/perf/report-export';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** PDF real do relatório mensal (administradora). Relatório finalizado usa os dados congelados. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; month: string }> }) {
  const { id, month } = await params;
  await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) return new NextResponse('Mês inválido.', { status: 400 });
  const client = await getClient(id);
  if (!client) return new NextResponse('Cliente não encontrado.', { status: 404 });
  const supabase = await createClient();
  const rep = await getReport(supabase, id, `${month}-01`);
  if (!rep) return new NextResponse('Relatório não encontrado.', { status: 404 });
  const { data } = await reportData(supabase, client, rep.row, `${month}-01`);
  const url = new URL(req.url);
  return reportPdfResponse({ data, edits: rep.edits, origin: url.origin, inline: url.searchParams.get('inline') === '1' });
}
