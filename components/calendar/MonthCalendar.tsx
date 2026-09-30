'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { ContentCardData } from '@/lib/types';
import { FormatIcon } from '@/components/content/Badges';
import { STATUS_META } from '@/lib/constants';
import { cn, toDateKey } from '@/lib/utils';

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Calendário editorial mensal. Cada conteúdo aparece no seu dia, com ícone por formato. */
export function MonthCalendar({
  items,
  hrefBase,
  newHrefBase,
  initialMonth,
}: {
  items: ContentCardData[];
  /** Link de cada conteúdo = `${hrefBase}/${id}` (funções não cruzam servidor → cliente). */
  hrefBase: string;
  /** Admin: link para criar conteúdo em um dia (botão +) = `${newHrefBase}${YYYY-MM-DD}`. */
  newHrefBase?: string;
  initialMonth?: string; // YYYY-MM
}) {
  const hrefFor = (item: ContentCardData) => `${hrefBase}/${item.id}`;
  const newHrefFor = newHrefBase ? (d: string) => `${newHrefBase}${d}` : undefined;
  const today = new Date();
  const start = initialMonth ? new Date(Number(initialMonth.slice(0, 4)), Number(initialMonth.slice(5, 7)) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const [cursor, setCursor] = useState(start);
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, ContentCardData[]>();
    for (const it of items) {
      if (!it.scheduled_date) continue;
      const arr = map.get(it.scheduled_date) ?? [];
      arr.push(it);
      map.set(it.scheduled_date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));
    return map;
  }, [items]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);

  const todayKey = toDateKey(today);
  const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor).replace(' de ', ' · ');
  const undated = items.filter((i) => !i.scheduled_date);
  const selectedItems = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="h-display text-3xl text-wine first-letter:uppercase sm:text-4xl">{title}</h2>
        <div className="flex items-center gap-1">
          <button aria-label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-full border border-wine/25 p-2 text-wine transition hover:bg-wine hover:text-white">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))} className="rounded-full px-3 py-2 text-xs text-wine transition hover:bg-blush">
            Hoje
          </button>
          <button aria-label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-full border border-wine/25 p-2 text-wine transition hover:bg-wine hover:text-white">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden !rounded-3xl">
        <div className="grid grid-cols-7 border-b border-wine/15 bg-blush/60">
          {WEEK.map((w) => (
            <div key={w} className="label py-2.5 text-center text-wine/70">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-16 border-b border-r border-wine/10 bg-blush-soft/60 sm:min-h-32" />;
            const key = toDateKey(d);
            const list = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={i}
                onClick={() => list.length && setSelected(key === selected ? null : key)}
                className={cn(
                  'group/day relative min-h-16 border-b border-r border-wine/10 p-1 sm:min-h-32 sm:p-2',
                  list.length && 'cursor-pointer sm:cursor-default',
                  key === selected && 'bg-blush/60 sm:bg-transparent',
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn('inline-flex size-6 items-center justify-center rounded-full text-xs', isToday ? 'bg-wine text-white' : 'text-ink/60')}>{d.getDate()}</span>
                  {newHrefFor && (
                    <Link
                      href={newHrefFor(key)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Novo conteúdo em ${key}`}
                      className="hidden rounded-full p-1 text-wine/50 opacity-0 transition hover:bg-blush hover:text-wine group-hover/day:opacity-100 sm:block"
                    >
                      <Plus className="size-3.5" />
                    </Link>
                  )}
                </div>

                {/* desktop: chips com título */}
                <div className="mt-1 hidden space-y-1 sm:block">
                  {list.slice(0, 3).map((it) => (
                    <Link
                      key={it.id}
                      href={hrefFor(it)}
                      className={cn('flex items-center gap-1.5 truncate rounded-lg border px-1.5 py-1 text-[0.7rem] leading-tight transition hover:brightness-95', STATUS_META[it.status].chip)}
                    >
                      <FormatIcon format={it.format} className="size-3 shrink-0" />
                      <span className="truncate">{it.title}</span>
                    </Link>
                  ))}
                  {list.length > 3 && <p className="px-1 text-[0.68rem] text-wine">+{list.length - 3} mais</p>}
                </div>

                {/* mobile: só os ícones; toque abre a lista do dia */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((it) => (
                    <span key={it.id} className={cn('inline-flex size-5 items-center justify-center rounded-full border', STATUS_META[it.status].chip)}>
                      <FormatIcon format={it.format} className="size-3" />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && selectedItems.length > 0 && (
        <div className="card animate-rise mt-4 space-y-2 p-4 sm:hidden">
          <p className="label text-wine">{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(`${selected}T12:00:00`))}</p>
          {selectedItems.map((it) => (
            <Link key={it.id} href={hrefFor(it)} className="flex items-center gap-3 rounded-2xl border border-wine/15 p-3">
              <FormatIcon format={it.format} className="size-5 text-wine" />
              <span className="min-w-0 flex-1 truncate text-sm">{it.title}</span>
              <span className="text-[0.7rem] text-wine">{STATUS_META[it.status].label}</span>
            </Link>
          ))}
        </div>
      )}

      {undated.length > 0 && (
        <div className="mt-6">
          <p className="label mb-2 text-wine/70">Sem data definida</p>
          <div className="flex flex-wrap gap-2">
            {undated.map((it) => (
              <Link key={it.id} href={hrefFor(it)} className="inline-flex items-center gap-2 rounded-full border border-wine/25 px-3 py-1.5 text-xs text-wine hover:bg-blush">
                <FormatIcon format={it.format} className="size-3.5" /> {it.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
