'use client';

import { RichText } from '@/components/ui/RichText';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { monthKey, monthTitle, shortDate, type ScriptRow } from '@/lib/extras/types';
import { cn } from '@/lib/utils';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // alternativa para navegadores que bloqueiam a área de transferência
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Roteiros dos vídeos a gravar: numerados na ordem de gravação, com copiar em um toque. */
export function ScriptsList({ rows }: { rows: ScriptRow[] }) {
  const months = [...new Set(rows.map((r) => monthKey(r.month)))];
  const [month, setMonth] = useState(months[0]);
  const [copied, setCopied] = useState<string | null>(null);
  const toast = useToast();
  const list = rows.filter((r) => monthKey(r.month) === month).sort((a, b) => a.position - b.position);

  const copy = async (id: string, text: string, msg: string) => {
    const ok = await copyText(text);
    if (!ok) return toast('Não consegui copiar. Segure o texto para selecionar e copiar.', 'error');
    setCopied(id);
    toast(msg);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  };
  const all = list.map((r, i) => `${i + 1}. ${r.title}\n\n${r.script}`).join('\n\n———\n\n');

  return (
    <div>
      {months.length > 1 && (
        <div className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1">
          {months.map((m) => <button key={m} onClick={() => setMonth(m)} className={cn('shrink-0 rounded-full border px-4 py-2 text-[0.82rem] transition', m === month ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{monthTitle(`${m}-01`)}</button>)}
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/65">{list.length} {list.length === 1 ? 'vídeo' : 'vídeos'} para gravar em <strong className="font-normal text-wine">{monthTitle(`${month}-01`)}</strong>, na ordem sugerida.</p>
        {list.length > 1 && <Button variant="outline" size="sm" onClick={() => copy('all', all, 'Todos os roteiros copiados ♡')}><Copy className="size-3.5" /> Copiar todos</Button>}
      </div>
      <ol className="space-y-5">
        {list.map((r, i) => (
          <li key={r.id} className="card p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="h-display flex size-11 shrink-0 items-center justify-center rounded-full bg-wine text-xl text-white">{i + 1}</span>
              <div className="min-w-0">
                <h2 className="h-display text-2xl leading-tight text-wine sm:text-3xl">{r.title}</h2>
                {r.shoot_date && <p className="mt-1 text-xs text-ink/55">Postar em {shortDate(r.shoot_date)}</p>}
              </div>
            </div>
            {r.notes && <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">{r.notes}</p>}
            {r.script ? (
              <>
                <div className="mt-4 rounded-2xl border border-wine/10 bg-blush-soft px-4 py-4 text-[1rem] leading-relaxed text-ink/90 select-text sm:px-5"><RichText text={r.script} /></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="lg" className="!tracking-[0.08em] max-sm:w-full max-sm:!text-[0.8rem]" onClick={() => copy(r.id, r.script, 'Roteiro copiado ♡')}>
                    {copied === r.id ? <><Check className="size-4" /> Copiado!</> : <><Copy className="size-4" /> Copiar roteiro</>}
                  </Button>
                  <Button variant="outline" onClick={() => copy(`${r.id}-t`, `${r.title}\n\n${r.script}`, 'Título e roteiro copiados ♡')} className="max-sm:w-full">Copiar com título</Button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-ink/50">O roteiro deste vídeo ainda está sendo preparado.</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
