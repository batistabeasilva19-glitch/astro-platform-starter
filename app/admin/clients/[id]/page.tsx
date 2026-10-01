import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getClient } from '@/lib/data/clients';
import { fetchCards, fetchFeed } from '@/lib/data/content';
import { AWAITING } from '@/lib/constants';
import { getSiteUrl } from '@/lib/site-url';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { ContentRow } from '@/components/content/ContentCard';
import { ProfileFeed } from '@/components/feed/ProfileFeed';
import { LinkActions } from '@/components/admin/LinkActions';
import { SendAllButton } from '@/components/admin/ClientActions';
import { Avatar, EmptyState } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { ViewTabs, parseView } from '@/components/ui/ViewTabs';

export default async function ClientWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const view = parseView((await searchParams).view);
  const client = await getClient(id);
  if (!client) notFound();
  const supabase = await createClient();
  const items = await fetchCards(supabase, { clientId: id });
  const { count: identityCount } = await supabase.from('identity_projects').select('id', { count: 'exact', head: true }).eq('client_id', id);
  const feed = view === 'feed' ? await fetchFeed(supabase, id) : null;

  const c = (f: (s: string) => boolean) => items.filter((i) => f(i.status)).length;
  const drafts = c((s) => s === 'draft');
  const project = client.project;
  const url = project ? `${await getSiteUrl()}/review/${project.review_token}` : '';

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/clients" className="label text-wine/70 hover:text-wine">← Clientes</Link>

      <header className="card mt-4 flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={client.company_name} src={client.avatar_url} className="size-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="h-display text-3xl text-wine sm:text-4xl">{client.company_name}</h1>
            <p className="mt-1 text-sm text-ink/60">
              @{client.instagram_handle || '—'} · Responsável: {client.contact_name || '—'}
            </p>
          </div>
          <LinkButton href={`/admin/clients/${id}/edit`} variant="ghost" size="sm">
            <Pencil className="size-3.5" /> Editar
          </LinkButton>
        </div>
        {project && <LinkActions clientId={id} url={url} active={project.token_active} />}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ['Rascunhos', drafts],
            ['Aguardando', c((s) => AWAITING.includes(s as never))],
            ['Aprovados', c((s) => s === 'approved')],
            ['Alteração', c((s) => s === 'changes_requested')],
            ['Programados', c((s) => s === 'scheduled')],
            ['Publicados', c((s) => s === 'published')],
          ].map(([l, n]) => (
            <span key={l as string} className="rounded-full bg-blush px-3 py-1 text-wine">
              {n} {l}
            </span>
          ))}
        </div>
      </header>

      {/* dois módulos independentes: cada um abre a sua própria página */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-5">
          <p className="label mb-2 text-wine/70">Conteúdo</p>
          <p className="mb-3 text-sm text-ink/65">Posts, carrosséis, Reels, Stories, calendário e feed.</p>
          <Link href={`/admin/clients/${id}`} className="text-sm text-wine underline-offset-4 hover:underline">Ver conteúdos →</Link>
        </div>
        <div className="card p-5">
          <p className="label mb-2 text-wine/70">Identidade Visual</p>
          <p className="mb-3 text-sm text-ink/65">{identityCount ? `${identityCount} ${identityCount === 1 ? 'projeto' : 'projetos'} de branding.` : 'Nenhum projeto de branding ainda.'}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link href={`/admin/identidades?cliente=${id}`} className="text-wine underline-offset-4 hover:underline">Ver projetos →</Link>
            <Link href={`/admin/identidades/new?client=${id}`} className="text-wine underline-offset-4 hover:underline">+ Nova identidade →</Link>
          </div>
        </div>
      </div>

      <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3">
        <ViewTabs basePath={`/admin/clients/${id}`} current={view} />
        <div className="flex flex-wrap gap-2">
          <SendAllButton clientId={id} drafts={drafts} />
          <LinkButton href={`/admin/content/new?client=${id}`}>
            <Plus className="size-4" /> Novo conteúdo
          </LinkButton>
        </div>
      </div>

      {view === 'calendar' && <MonthCalendar items={items} hrefBase="/admin/content" newHrefBase={`/admin/content/new?client=${id}&date=`} />}

      {view === 'list' &&
        (items.length === 0 ? (
          <EmptyState title="Nenhum conteúdo ainda">Crie o primeiro conteúdo deste cliente.</EmptyState>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <ContentRow key={i.id} item={i} href={`/admin/content/${i.id}`} />
            ))}
          </div>
        ))}

      {view === 'feed' && feed && (
        <ProfileFeed
          key={feed.grid.map((g) => g.id).join()}
          profile={{ handle: client.instagram_handle, displayName: client.display_name || client.company_name, bio: client.bio, avatarUrl: client.avatar_url }}
          items={feed.grid}
          stories={feed.stories}
          hrefBase="/admin/content"
          clientId={id}
          editable
          savedLayout={feed.hasLayout}
        />
      )}
    </div>
  );
}
