import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, listClients, requireUser } from '@/lib/data/clients';
import { fetchDetail } from '@/lib/data/content';
import { ContentForm } from '@/components/admin/ContentForm';
import { ContentWorkspace } from '@/components/admin/ContentWorkspace';
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

  return (
    <div className="mx-auto max-w-7xl">
      <Link href={`/admin/clients/${client.id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-8 mt-3">
        <p className="label mb-2 flex flex-wrap items-center gap-x-4 text-wine/70">
          <FormatTag format={content.format} className="text-wine" />
          <span>{fmtDate(content.scheduled_date, true)}{content.scheduled_time ? ` · ${fmtTime(content.scheduled_time)}` : ''}</span>
        </p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">{content.title}</h1>
        {isNew && <p className="mt-3 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Conteúdo criado ♡ Agora suba as artes abaixo e, quando estiver pronto, clique em “Enviar para aprovação”.</p>}
      </header>
      <ContentWorkspace
        content={content}
        ownerId={user.id}
        client={{ id: client.id, handle: client.instagram_handle, displayName: client.display_name || client.company_name, avatarUrl: client.avatar_url }}
        form={<ContentForm clients={clients.map((c) => ({ id: c.id, company_name: c.company_name }))} clientId={client.id} content={content} version={current} />}
      />
    </div>
  );
}
