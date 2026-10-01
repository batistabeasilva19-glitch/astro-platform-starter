import Link from 'next/link';
import { notFound } from 'next/navigation';
import { clientCards, clientFeed, resolveToken } from '@/lib/data/portal';
import { listPublicStrategyDocs } from '@/lib/data/strategy';
import { listReleasedReports } from '@/lib/data/perf';
import { portalCounts } from '@/lib/data/extras';
import { createAdminClient } from '@/lib/supabase/admin';
import { AWAITING } from '@/lib/constants';
import { ContentCard } from '@/components/content/ContentCard';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { ProfileFeed } from '@/components/feed/ProfileFeed';
import { ApproveAll } from '@/components/review/ApproveAll';
import { BrandElement } from '@/components/brand/Brand';
import { ArrowRight, BarChart3, CalendarCheck, FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/Misc';
import { ViewTabs, parseView } from '@/components/ui/ViewTabs';
import { firstName } from '@/lib/utils';
import type { ContentCardData } from '@/lib/types';

export default async function ReviewHome({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ view?: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const view = parseView((await searchParams).view, 'list');
  const { client } = session;

  const items = await clientCards(session);
  const strategyCount = (await listPublicStrategyDocs(createAdminClient(), client.id)).length;
  const resultsCount = (await listReleasedReports(createAdminClient(), client.id)).length;
  const extras = await portalCounts(createAdminClient(), client.id);
  const awaiting = items.filter((i) => AWAITING.includes(i.status));
  const changes = items.filter((i) => i.status === 'changes_requested');
  const approved = items.filter((i) => ['approved', 'scheduled', 'published'].includes(i.status));
  const feed = view === 'feed' ? await clientFeed(session) : null;
  const base = `/review/${token}`;

  const Section = ({ title, list }: { title: string; list: ContentCardData[] }) =>
    list.length === 0 ? null : (
      <section className="mb-12">
        <h2 className="h-display mb-5 text-3xl text-wine">{title} <span className="label align-middle text-ink/40">{list.length}</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
          {list.map((i) => (
            <ContentCard key={i.id} item={i} href={`${base}/c/${i.id}`} audience="client" />
          ))}
        </div>
      </section>
    );

  return (
    <div>
      {/* Boas-vindas */}
      <section className="relative mb-10 overflow-hidden rounded-[2rem] bg-blush px-6 py-10 sm:px-12 sm:py-14">
        <BrandElement name="sparkles" tone="wine" className="absolute right-6 top-6 w-14 opacity-70 sm:w-20" />
        <h1 className="script text-6xl text-wine sm:text-7xl">Olá, {firstName(client.contact_name || client.company_name)} ♡</h1>
        <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-ink/80">
          Aqui você encontra todos os conteúdos que preparamos para sua marca. Analise cada publicação com calma e utilize os botões de aprovação ou alteração para enviar seu feedback.
        </p>
        <BrandElement name="brush-stroke" tone="wine" className="mt-6 w-44 opacity-50" />
      </section>

      {/* Contadores */}
      <section className="mb-10 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          ['Aguardando', awaiting.length, true],
          ['Aprovados', approved.length, false],
          ['Alterações', changes.length, false],
        ].map(([label, n, hi]) => (
          <div key={label as string} className={`card p-4 text-center sm:p-6 ${hi && (n as number) > 0 ? '!border-wine !bg-wine text-white' : ''}`}>
            <p className={`label ${hi && (n as number) > 0 ? 'text-white/80' : 'text-wine/70'}`}>{label}</p>
            <p className={`h-display mt-2 text-5xl sm:text-6xl ${hi && (n as number) > 0 ? 'text-white' : 'text-wine'}`}>{n}</p>
          </div>
        ))}
      </section>

      {awaiting.length > 0 && (
        <section className="mb-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-wine/20 bg-white p-5 sm:flex-row sm:items-center sm:px-8">
          <p className="text-[0.95rem]">
            <strong className="font-normal text-wine">{awaiting.length} {awaiting.length === 1 ? 'conteúdo espera' : 'conteúdos esperam'}</strong> sua aprovação. Já revisou tudo?
          </p>
          <ApproveAll token={token} count={awaiting.length} />
        </section>
      )}

      {(extras.stories > 0 || extras.scripts > 0 || extras.plans > 0) && (
        <Link href={`${base}/cronograma`} className="mb-8 flex items-center gap-4 rounded-3xl bg-wine p-5 text-white shadow-sm transition hover:bg-wine/90">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><CalendarCheck className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="label block text-white/70">Organização</span>
            <span className="h-display text-2xl text-white">Cronograma de entregas</span>
            <span className="block text-xs text-white/75">{[extras.scripts > 0 && 'roteiro de vídeos', extras.plans > 0 && 'calendário do mês', extras.stories > 0 && 'stories do dia'].filter(Boolean).join(' · ')}</span>
          </span>
          <ArrowRight className="size-5" />
        </Link>
      )}

      {strategyCount > 0 && (
        <Link href={`${base}/estrategia`} className="mb-8 flex items-center gap-4 rounded-3xl bg-wine p-5 text-white shadow-sm transition hover:bg-wine/90">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white"><FileText className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="label block text-white/70">Documentos</span>
            <span className="h-display text-2xl text-white">Estratégia de rede</span>
            <span className="block text-xs text-white/75">{strategyCount} {strategyCount === 1 ? 'documento' : 'documentos'}, organizados por mês</span>
          </span>
          <ArrowRight className="size-5 text-white" />
        </Link>
      )}

      {resultsCount > 0 && (
        <Link href={`${base}/resultados`} className="mb-8 flex items-center gap-4 rounded-3xl bg-wine p-5 text-white shadow-sm transition hover:bg-wine/90">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white"><BarChart3 className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="label block text-white/70">Desempenho</span>
            <span className="h-display text-2xl text-white">Resultados</span>
            <span className="block text-xs text-white/75">{resultsCount} {resultsCount === 1 ? 'relatório mensal disponível' : 'relatórios mensais disponíveis'}</span>
          </span>
          <ArrowRight className="size-5 text-white" />
        </Link>
      )}

      <div className="mb-8 flex justify-center sm:justify-start">
        <ViewTabs basePath={base} current={view} />
      </div>

      {items.length === 0 ? (
        <EmptyState title="Ainda não há conteúdos por aqui">Assim que a Soltria enviar os conteúdos para aprovação, eles aparecem nesta página. ♡</EmptyState>
      ) : view === 'list' ? (
        <>
          <Section title="Aguardando sua aprovação" list={awaiting} />
          <Section title="Alterações solicitadas" list={changes} />
          <Section title="Aprovados" list={approved} />
        </>
      ) : view === 'calendar' ? (
        <MonthCalendar items={items} hrefBase={`${base}/c`} />
      ) : (
        feed && (
          <>
            <p className="mb-6 text-center text-sm text-ink/60">Assim seu perfil pode ficar com os conteúdos planejados. Toque em uma publicação para abrir.</p>
            <ProfileFeed
              profile={{ handle: client.instagram_handle, displayName: client.display_name || client.company_name, bio: client.bio, avatarUrl: session.avatarUrl }}
              items={feed.grid}
              stories={feed.stories}
              hrefBase={`${base}/c`}
            />
          </>
        )
      )}
      <Link href={base} className="sr-only">Início</Link>
    </div>
  );
}
