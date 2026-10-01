'use client';

import { RichText } from '@/components/ui/RichText';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink } from 'lucide-react';
import { setStoryDone } from '@/lib/actions/extras-portal';
import { useToast } from '@/components/ui/Toast';
import { dayTitle, shortDate, type StoryRow } from '@/lib/extras/types';
import { cn } from '@/lib/utils';

const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Stories do dia em ordem (1, 2, 3…): a cliente marca “OK, postei” em cada um que publicou. */
export function StoriesChecklist({ token, rows, thumbs }: { token: string; rows: StoryRow[]; thumbs: Record<string, string> }) {
  const days = [...new Set(rows.map((r) => r.story_date))].sort();
  const today = todayKey();
  const initial = days.includes(today) ? today : (days.find((d) => d > today) ?? days[days.length - 1]);
  const [day, setDay] = useState(initial);
  const [local, setLocal] = useState(rows);
  useEffect(() => setLocal(rows), [rows]);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const list = local.filter((r) => r.story_date === day).sort((a, b) => a.position - b.position);
  const done = list.filter((r) => r.done).length;
  const stat = (d: string) => {
    const l = local.filter((r) => r.story_date === d);
    return { done: l.filter((r) => r.done).length, total: l.length };
  };

  const toggle = async (s: StoryRow) => {
    const value = !s.done;
    setBusy(s.id);
    setLocal((cur) => cur.map((r) => (r.id === s.id ? { ...r, done: value } : r)));
    const res = await setStoryDone(token, s.id, value);
    setBusy(null);
    if (!res.ok) {
      setLocal(rows);
      return toast(res.error, 'error');
    }
    if (value) toast('Marcado como postado ♡');
    router.refresh();
  };

  return (
    <div>
      <div className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1">
        {days.map((d) => {
          const p = stat(d);
          const complete = p.total > 0 && p.done === p.total;
          return (
            <button key={d} onClick={() => setDay(d)} className={cn('shrink-0 rounded-full border px-4 py-2 text-[0.82rem] transition', d === day ? 'border-wine bg-wine text-white' : complete ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>
              {d === today ? 'Hoje' : shortDate(d)} · {p.done}/{p.total}
            </button>
          );
        })}
      </div>

      <section className="card mb-6 p-5">
        <h2 className="h-display text-2xl text-wine sm:text-3xl">{dayTitle(day)}{day === today ? ' · hoje' : ''}</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-blush"><div className="h-full rounded-full bg-wine transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} /></div>
          <span className="text-sm text-ink/65">{done} de {list.length} postados</span>
        </div>
        {list.length > 0 && done === list.length && <p className="mt-3 text-sm text-wine">Tudo postado por hoje. Obrigada! ♡</p>}
      </section>

      <ol className="space-y-4">
        {list.map((s, i) => (
          <li key={s.id} className={cn('card p-4 transition sm:p-5', s.done && 'border-emerald-300 bg-emerald-50/50')}>
            <div className="flex items-start gap-4">
              <span className={cn('h-display flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-white', s.done ? 'bg-emerald-600' : 'bg-wine')}>{s.done ? <Check className="size-5" /> : i + 1}</span>
              {s.content_id && thumbs[s.content_id] && <img src={thumbs[s.content_id]} alt="" loading="lazy" className="h-24 w-[4.25rem] shrink-0 rounded-xl object-cover sm:h-28 sm:w-20" />}
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-wine/60">Story {i + 1}</p>
                <h3 className={cn('text-[1.05rem] leading-snug text-ink', s.done && 'text-ink/60')}>{s.title}</h3>
                {s.description && <RichText text={s.description} className="mt-1 text-sm leading-relaxed text-ink/65" />}
                {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-wine underline-offset-4 hover:underline">Abrir arte / pasta <ExternalLink className="size-3.5" /></a>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggle(s)}
              disabled={busy === s.id}
              aria-pressed={s.done}
              className={cn('mt-4 flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-[0.9rem] tracking-wide transition active:scale-[0.98] sm:ml-[3.75rem] sm:w-auto', s.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-wine bg-wine text-white hover:bg-wine-dark')}
            >
              <Check className="size-4" /> {s.done ? 'Postado ✓ (toque para desfazer)' : 'OK, postei'}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="card border-dashed px-6 py-10 text-center text-sm text-ink/55">Nenhum story neste dia.</li>}
      </ol>
    </div>
  );
}
