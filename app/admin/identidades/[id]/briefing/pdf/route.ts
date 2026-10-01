import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { fetchIdentityDetail } from '@/lib/data/identity';
import { briefingPdfResponse } from '@/lib/identity/briefing-export';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Baixar o formulário da marca em PDF (somente a administradora logada; respeita RLS). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const detail = await fetchIdentityDetail(supabase, id);
  if (!detail) return new NextResponse('Projeto não encontrado.', { status: 404 });
  const { data: client } = await supabase.from('clients').select('company_name').eq('id', detail.project.client_id).maybeSingle();
  const url = new URL(req.url);
  return briefingPdfResponse({ detail, clientName: client?.company_name ?? 'Cliente', origin: url.origin, inline: url.searchParams.get('inline') === '1' });
}
