import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, listClients, requireUser } from '@/lib/data/clients';
import { fetchDetail } from '@/lib/data/content';
import { ContentForm } from '@/components/admin/ContentForm';
import { ContentWorkspace } from '@/components/admin/ContentWorkspace';
import { ContentPerformancePanel } from '@/components/perf/ContentPerformancePanel';
import type { SnapshotRow } from '@/lib/perf/types';
import { FormatTag } from '@/components/content/Badges';
import { fmtDate, fmtTime } from '@/lib/utils';

export async function generateMetadata() {
  return { title: 'Conteúdo' };
}

export default async function ContentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const content = await fetchDetail(supabase, id);
  if (!content) notFound();
  const [client, clients] = await Promise.all([getClient(content.client_id), listClients()]);
  if (!client) notFound();
  const current = content.versions.find((v) => v.version_number === content.current_version) ?? content.versions[0];
  const isNew = (await searchParams).novo === '1';

  // desempenho (migration 0008): se as tabelas ainda não existem, o painel avisa em vez de quebrar a página
  const [metaRes, snapRes, tagsRes] = await Promise.all([
    supabase.from('perf_content_meta').select('tags, objectives').eq('content_id', id).maybeSingle(),
    supabase.from('perf_content_snapshots').select('*').eq('content_id', id).order('collected_on'),
    supabase.from('perf_content_meta').select('tags').eq('client_id', content.client_id),
  ]);
  const perfMissing = !!(metaRes.error || snapRes.error);
  const knownTags = [...new Set((tagsRes.data ?? []).flatMap((r) => (r.tags ?? []) as string[]))];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href={`/admin/clients/${client.id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-8 mt-3">
        <p className="label mb-2 flex flex-wrap items-center gap-x-4 text-wine/70">
          <FormatTag format={content.format} className="text-wine" />
          <span>{fmtDate(content.scheduled_date, true)}{content.scheduled_time ? ` · ${fmtTime(content.scheduled_time)}` : ''}</span>
        </p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">{content.title}</h1>
        <p className="mt-3 flex gap-4 text-sm"><a href="#" className="text-wine underline-offset-4 hover:underline">Conteúdo</a><a href="#desempenho" className="text-wine underline-offset-4 hover:underline">Desempenho ↓</a></p>
        {isNew && <p className="mt-3 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Conteúdo criado ♡ Agora suba as artes abaixo e, quando estiver pronto, clique em “Enviar para aprovação”.</p>}
      </header>
      <ContentWorkspace
        content={content}
        ownerId={user.id}
        client={{ id: client.id, handle: client.instagram_handle, displayName: client.display_name || client.company_name, avatarUrl: client.avatar_url }}
        form={<ContentForm clients={clients.map((c) => ({ id: c.id, company_name: c.company_name }))} clientId={client.id} content={content} version={current} />}
      />
      <div className="mt-8">
        <ContentPerformancePanel
          content={{ id: content.id, title: content.title, format: content.format, status: content.status, scheduled_date: content.scheduled_date }}
          tags={(metaRes.data?.tags ?? []) as string[]}
          objectives={(metaRes.data?.objectives ?? []) as string[]}
          snapshots={(snapRes.data ?? []) as SnapshotRow[]}
          knownTags={knownTags}
          missing={perfMissing}
        />
      </div>
    </div>
  );
}
