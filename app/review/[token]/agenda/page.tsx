import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Clapperboard, ExternalLink, MapPin, Users, Video } from 'lucide-react';
import { resolveToken } from '@/lib/data/portal';
import { portalEvents } from '@/lib/data/extras';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/components/ui/Misc';
import { RichText } from '@/components/ui/RichText';
import { EVENT_KINDS, EVENT_STATUS_LABEL, dayTitle, googleCalendarUrl, hhmm, type EventRow } from '@/lib/extras/types';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Agenda' };
export const dynamic = 'force-dynamic';

const btn = 'inline-flex items-center gap-2 rounded-full border border-wine px-4 py-2 text-[0.8rem] text-wine transition hover:bg-wine hover:text-white';

function EventCard({ e, past }: { e: EventRow; past?: boolean }) {
  const Icon = e.kind === 'meeting' ? Users : Clapperboard;
  const cancelled = e.status === 'cancelled';
  const [, m, d] = e.event_date.split('-');
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, Number(m) - 1, 1))).replace('.', '');
  return (
    <li className={cn('card flex gap-4 p-4 sm:p-5', (past || cancelled) && 'opacity-70')}>
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-wine py-2 text-white">
        <span className="h-display text-3xl leading-none">{d}</span>
        <span className="label mt-1 text-white/80">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="label flex flex-wrap items-center gap-x-3 text-wine/70">
          <span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" /> {EVENT_KINDS.find((k) => k.id === e.kind)?.label}</span>
          {(cancelled || e.status === 'done') && <span className={cn('rounded-full px-2 py-0.5 normal-case tracking-normal', cancelled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800')}>{EVENT_STATUS_LABEL[e.status]}</span>}
        </p>
        <h3 className={cn('mt-1 font-sans text-lg font-medium leading-snug text-wine', cancelled && 'line-through')}>{e.title}</h3>
        <p className="mt-1 text-sm text-ink/65">
          {dayTitle(e.event_date)}{e.start_time ? ` · ${hhmm(e.start_time)}${e.end_time ? ` às ${hhmm(e.end_time)}` : ''}` : ''}
        </p>
        {e.location && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink/65"><MapPin className="mt-0.5 size-4 shrink-0 text-wine/70" /> {e.location}</p>
        )}
        {e.notes && <RichText text={e.notes} className="mt-3 rounded-2xl bg-blush-soft px-4 py-3 text-sm leading-relaxed text-ink/80" />}
        {!past && !cancelled && (
          <div className="mt-4 flex flex-wrap gap-2">
            {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-wine px-4 py-2 text-[0.8rem] text-white transition hover:bg-wine/90"><Video className="size-4" /> Entrar na reunião</a>}
            <a href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer" className={btn}><CalendarPlus className="size-4" /> Adicionar à minha agenda</a>
            {e.kind === 'recording' && e.location && !e.link && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`} target="_blank" rel="noopener noreferrer" className={btn}><ExternalLink className="size-4" /> Ver no mapa</a>}
          </div>
        )}
      </div>
    </li>
  );
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveToken(token);
  if (!session) notFound();
  const rows = await portalEvents(createAdminClient(), session.client.id);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((r) => r.event_date >= today);
  const past = rows.filter((r) => r.event_date < today).reverse();
  return (
    <div>
      <Link href={`/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3"><ArrowLeft className="size-4" /> Voltar</Link>
      <header className="mb-8">
        <p className="label mb-3 text-wine/70">Compromissos</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Agenda</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65">Os dias das gravações e das reuniões de alinhamento. Toque em “Adicionar à minha agenda” para receber o lembrete no seu celular.</p>
      </header>
      {rows.length === 0 ? (
        <EmptyState title="Nada agendado por enquanto">Quando a Soltria marcar uma gravação ou reunião, ela aparece aqui. ♡</EmptyState>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="label mb-3 text-wine/70">Próximos</h2>
            {upcoming.length ? <ul className="space-y-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</ul> : <p className="text-sm text-ink/55">Nenhum compromisso marcado daqui para frente.</p>}
          </section>
          {past.length > 0 && (
            <details>
              <summary className="label cursor-pointer text-wine/70">Já passaram ({past.length})</summary>
              <ul className="mt-3 space-y-3">{past.map((e) => <EventCard key={e.id} e={e} past />)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
