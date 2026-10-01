import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { adminEvents, adminPlans, adminScripts, adminStories, contentOptions } from '@/lib/data/extras';
import { Avatar } from '@/components/ui/Misc';
import { MissingNotice } from '@/components/extras/MissingNotice';
import { ScriptsManager } from '@/components/extras/ScriptsManager';
import { PlanManager } from '@/components/extras/PlanManager';
import { EventsManager } from '@/components/extras/EventsManager';
import { StoriesManager } from '@/components/extras/StoriesManager';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Cronograma de entregas' };

const TABS = [
  { id: 'videos', label: 'Roteiro de vídeos' },
  { id: 'mes', label: 'Calendário do mês' },
  { id: 'stories', label: 'Stories' },
  { id: 'agenda', label: 'Agenda' },
] as const;

export default async function SchedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba } = await searchParams;
  await requireUser();
  const client = await getClient(id);
  if (!client) notFound();
  const tab = TABS.some((t) => t.id === aba) ? (aba as (typeof TABS)[number]['id']) : 'videos';
  const supabase = await createClient();

  let body: React.ReactNode;
  if (tab === 'videos') {
    const { rows, missing } = await adminScripts(supabase, id);
    body = missing ? <MissingNotice /> : <ScriptsManager clientId={id} rows={rows} />;
  } else if (tab === 'mes') {
    const { plans, missing, thumbs } = await adminPlans(supabase, id);
    const contents = missing ? [] : await contentOptions(supabase, id);
    body = missing ? <MissingNotice /> : <PlanManager clientId={id} plans={plans} thumbs={thumbs} contents={contents} />;
  } else if (tab === 'agenda') {
    const { rows, missing } = await adminEvents(supabase, id);
    body = missing ? <MissingNotice file="0015_agenda_cliente.sql" /> : <EventsManager clientId={id} rows={rows} />;
  } else {
    const { rows, missing } = await adminStories(supabase, id);
    const contents = missing ? [] : await contentOptions(supabase, id, ['story']);
    body = missing ? <MissingNotice /> : <StoriesManager clientId={id} rows={rows} contents={contents} />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="label text-wine/70 hover:text-wine">← {client.company_name}</Link>
      <header className="mb-6 mt-4 flex items-center gap-5">
        <Avatar name={client.company_name} src={client.avatar_url} className="size-16 text-xl" />
        <div>
          <p className="label mb-1 text-wine/70">Redes sociais</p>
          <h1 className="h-display text-3xl text-wine sm:text-4xl">Cronograma de entregas</h1>
          <p className="mt-1 text-sm text-ink/60">Tudo que o cliente recebe, na ordem de entrega: vídeos a gravar, calendário do mês, stories do dia e a agenda de gravações e reuniões.</p>
        </div>
      </header>
      <div className="no-scrollbar -mx-1 mb-6 flex gap-5 overflow-x-auto border-b border-wine/15 px-1">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/clients/${id}/cronograma?aba=${t.id}`} aria-current={tab === t.id ? 'page' : undefined} className={cn('-mb-px shrink-0 border-b-2 pb-3 text-sm transition', tab === t.id ? 'border-wine text-wine' : 'border-transparent text-ink/55 hover:text-wine')}>{t.label}</Link>
        ))}
      </div>
      {body}
    </div>
  );
}
