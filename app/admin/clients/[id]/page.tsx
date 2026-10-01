import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Pencil, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getClient, requireUser } from '@/lib/data/clients';
import { listProfileShots } from '@/lib/data/profile-shots';
import { loadAllTasks } from '@/lib/data/production';
import { productionStats } from '@/lib/production/stats';
import { ProfileBefore } from '@/components/admin/ProfileBefore';
import { fetchCards, fetchFeed } from '@/lib/data/content';
import { AWAITING } from '@/lib/constants';
import { getSiteUrl } from '@/lib/site-url';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { ContentRow } from '@/components/content/ContentCard';
import { ProfileFeed } from '@/components/feed/ProfileFeed';
import { LinkActions } from '@/components/admin/LinkActions';
import { SendAllButton } from '@/components/admin/ClientActions';
import { Avatar, EmptyState } from '@/components/ui/Misc';
import { LinkButton, buttonClass } from '@/components/ui/Button';
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
  const user = await requireUser();
  const supabase = await createClient();
  const { shots, missing: shotsMissing } = await listProfileShots(supabase, id);
  const prod = await loadAllTasks(supabase, { clientId: id });
  const ps = prod.missing ? null : productionStats(prod.tasks, prod.columns);
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
            ['Rascunhos', drafts, 'bg-zinc-100 text-zinc-700 ring-zinc-300'],
            ['Aguardando', c((s) => AWAITING.includes(s as never)), 'bg-amber-100 text-amber-800 ring-amber-300'],
            ['Aprovados', c((s) => s === 'approved'), 'bg-sky-100 text-sky-800 ring-sky-300'],
            ['Alteração', c((s) => s === 'changes_requested'), 'bg-red-100 text-red-700 ring-red-300'],
            ['Programados', c((s) => s === 'scheduled'), 'bg-violet-100 text-violet-800 ring-violet-300'],
            ['Publicados', c((s) => s === 'published'), 'bg-emerald-100 text-emerald-800 ring-emerald-300'],
          ].map(([l, n, cls]) => (
            <span key={l as string} className={`rounded-full px-3 py-1 ring-1 ring-inset ${cls} ${n ? '' : 'opacity-60'}`}>
              {n} {l}
            </span>
          ))}
        </div>
      </header>

      {/* dois módulos independentes: cada um abre a sua própria página */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <p className="label mb-2 text-wine/70">Conteúdo</p>
          <p className="mb-3 text-sm text-ink/65">Posts, carrosséis, Reels, Stories, calendário e feed.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/clients/${id}`} className={buttonClass('primary', 'sm')}>Ver conteúdos <span aria-hidden className="size-1.5 rounded-full bg-white/80" /></Link>
            <Link href={`/admin/clients/${id}/estrategia`} className={buttonClass('primary', 'sm')}>Estratégia de rede <span aria-hidden className="size-1.5 rounded-full bg-white/80" /></Link>
            <Link href={`/admin/clients/${id}/desempenho`} className={buttonClass('primary', 'sm')}>Desempenho <span aria-hidden className="size-1.5 rounded-full bg-white/80" /></Link>
            <Link href={`/admin/clients/${id}/relatorios`} className={buttonClass('primary', 'sm')}>Relatórios <span aria-hidden className="size-1.5 rounded-full bg-white/80" /></Link>
          </div>
        </div>
        <div className="card p-5">
          <p className="label mb-2 text-wine/70">Identidade Visual</p>
          <p className="mb-3 text-sm text-ink/65">{identityCount ? `${identityCount} ${identityCount === 1 ? 'projeto' : 'projetos'} de branding.` : 'Nenhum projeto de branding ainda.'}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/identidades?cliente=${id}`} className={buttonClass('primary', 'sm')}>Ver projetos →</Link>
            <Link href={`/admin/identidades/new?client=${id}`} className={buttonClass('primary', 'sm')}>+ Nova identidade →</Link>
          </div>
        </div>
        {ps && (
          <div className="card p-5">
            <p className="label mb-2 text-wine/70">Produção</p>
            <p className="mb-3 text-sm text-ink/65">
              {ps.open === 0 && ps.doneMonth === 0 ? 'Nenhuma tarefa deste cliente ainda.' : `${ps.open} ${ps.open === 1 ? 'tarefa aberta' : 'tarefas abertas'} · ${ps.production} em produção · ${ps.awaiting} aguardando aprovação · ${ps.changes} ${ps.changes === 1 ? 'alteração' : 'alterações'} · ${ps.doneMonth} ${ps.doneMonth === 1 ? 'concluída' : 'concluídas'}`}
            </p>
            <Link href={`/admin/producao/cliente/${id}`} className={buttonClass('primary', 'sm')}>Ver quadro do cliente <span aria-hidden className="size-1.5 rounded-full bg-white/80" /></Link>
          </div>
        )}
      </div>

      <div className="mt-6">
        <ProfileBefore ownerId={user.id} clientId={id} shots={shots} missing={shotsMissing} />
      </div>

      <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3">
        <ViewTabs basePath={`/admin/clients/${id}`} current={view} />
        <div className="flex flex-wrap gap-2">
          <SendAllButton clientId={id} drafts={drafts} awaiting={c((s) => AWAITING.includes(s as never))} changes={c((s) => s === 'changes_requested')} />
          <LinkButton href={`/admin/clients/${id}/estrategia`} variant="outline">
            <FileText className="size-4" /> Estratégia de rede
          </LinkButton>
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
