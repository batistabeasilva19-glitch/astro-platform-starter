import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarCheck, CalendarClock, Film, Smartphone } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { portalCounts } from '@/lib/data/extras';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/Misc';

export const metadata = { title: 'Cronograma de entregas' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const c = await portalCounts(createAdminClient(), session.client.id);
  const tiles = ([
    [c.scripts, 'roteiros', 'Gravações', 'Roteiro de vídeos', 'Os vídeos a gravar, em ordem, com o roteiro pronto para copiar.', Film],
    [c.plans, 'mes', 'Planejamento', 'Calendário do mês', 'Posts, carrosséis e Reels do mês, em ordem, para você aprovar.', CalendarCheck],
    [c.stories, 'stories', 'Publicações', 'Stories', 'Os stories de cada dia, em ordem. Marque “OK” em cada um que postar.', Smartphone],
    [c.events, 'agenda', 'Compromissos', 'Agenda', 'Dias de gravação e reuniões de alinhamento, com horário e local.', CalendarClock],
  ] as const).filter((t) => t[0] > 0);
  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3"><ArrowLeft className="size-4" /> Voltar</Link>
      <header className="mb-8">
        <p className="label mb-3 text-wine/70">Organização</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Cronograma de entregas</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Tudo que precisa acontecer, organizado em um só lugar: o que gravar, o que aprovar e o que postar.</p>
      </header>
      {tiles.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui">Quando a Soltria organizar o cronograma, ele aparece aqui. ♡</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map(([, path, kicker, title, sub, Icon]) => (
            <Link key={path} href={`/review/${token}/${path}`} className="flex items-center gap-4 rounded-3xl bg-wine p-6 text-white shadow-sm transition hover:bg-wine/90">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="label block text-white/70">{kicker}</span>
                <span className="h-display text-2xl text-white">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/75">{sub}</span>
              </span>
              <ArrowRight className="size-5 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
