'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MiniEvent {
  date: string; // YYYY-MM-DD
  kind: 'recording' | 'meeting';
  title: string;
  time: string; // HH:MM ou ''
}

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const KIND = { recording: 'Gravação', meeting: 'Reunião' } as const;

/** Calendário pequeno e sutil com os dias de gravação e reunião de alinhamento. Toque abre a Agenda. */
export function MiniAgenda({ events, href, today }: { events: MiniEvent[]; href: string; today: string }) {
  const first = events.find((e) => e.date >= today) ?? events[events.length - 1];
  const start = (first?.date ?? today).slice(0, 7);
  const [cursor, setCursor] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const { y, m } = cursor;
  const lead = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const key = (d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const by = new Map<string, MiniEvent[]>();
  for (const e of events) by.set(e.date, [...(by.get(e.date) ?? []), e]);
  const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
  const next = events.find((e) => e.date >= today);
  const nav = (d: number) => setCursor(({ y: yy, m: mm }) => { const t = new Date(yy, mm + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });

  return (
    <div className="w-full max-w-[15rem] rounded-2xl bg-white/60 p-3 text-wine ring-1 ring-wine/10 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <button aria-label="Mês anterior" onClick={() => nav(-1)} className="rounded-full p-1 hover:bg-wine/10"><ChevronLeft className="size-3.5" /></button>
        <span className="label !text-[0.62rem] first-letter:uppercase">{title}</span>
        <button aria-label="Próximo mês" onClick={() => nav(1)} className="rounded-full p-1 hover:bg-wine/10"><ChevronRight className="size-3.5" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.58rem] text-wine/50">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="mt-0.5 grid grid-cols-7 gap-y-0.5 text-center text-[0.68rem]">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = key(d);
          const evs = by.get(k);
          const isToday = k === today;
          const cls = cn('mx-auto flex size-6 items-center justify-center rounded-full', isToday && !evs && 'ring-1 ring-wine/40', evs?.some((e) => e.kind === 'recording') ? 'bg-wine text-white' : evs ? 'bg-blush-soft text-wine ring-1 ring-wine' : 'text-ink/60');
          return evs ? (
            <Link key={i} href={href} title={evs.map((e) => `${KIND[e.kind]}: ${e.title}`).join(' · ')} className={cls}>{d}</Link>
          ) : (
            <span key={i} className={cls}>{d}</span>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-[0.6rem] text-wine/70">
        <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-wine" /> Gravação</span>
        <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-blush-soft ring-1 ring-wine" /> Reunião</span>
      </div>
      {next && (
        <Link href={href} className="mt-2 block rounded-xl bg-wine/5 px-2 py-1.5 text-center text-[0.65rem] leading-snug hover:bg-wine/10">
          Próximo: <strong className="font-medium">{KIND[next.kind]}</strong> · {next.date.slice(8, 10)}/{next.date.slice(5, 7)}{next.time ? ` às ${next.time}` : ''}
        </Link>
      )}
    </div>
  );
}
