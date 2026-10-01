'use client';

import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Search } from 'lucide-react';
import { fmtSize, groupByMonth, monthKey, monthLabel, type PublicStrategyDoc } from '@/lib/strategy';
import { cn } from '@/lib/utils';

/** Portal do cliente: pesquisa por mês (chips + seletor) e por título. Os PDFs abrem pelo servidor. */
export function StrategyBrowser({ token, docs }: { token: string; docs: PublicStrategyDoc[] }) {
  const months = useMemo(() => groupByMonth(docs).map((g) => g.month), [docs]);
  const years = useMemo(() => [...new Set(months.map((m) => m.slice(0, 4)))], [months]);
  const [month, setMonth] = useState<string>('todos');
  const [year, setYear] = useState<string>('todos');
  const [q, setQ] = useState('');

  const text = q.trim().toLowerCase();
  const filtered = docs.filter((d) => {
    const m = monthKey(d.month);
    if (month !== 'todos' && m !== month) return false;
    if (year !== 'todos' && !m.startsWith(year)) return false;
    return !text || `${d.title} ${d.description} ${monthLabel(m)}`.toLowerCase().includes(text);
  });
  const groups = groupByMonth(filtered);
  const base = `/review/${token}/estrategia`;

  if (!docs.length) {
    return (
      <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
        <FileText className="size-6 text-wine/50" />
        <p className="h-display text-2xl text-wine">Ainda não há documentos</p>
        <p className="max-w-md text-sm text-ink/60">Quando a Soltria publicar a estratégia do mês, ela aparece aqui para você consultar. ♡</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-wine/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título ou mês (ex.: outubro)" className="field !rounded-full !pl-11" aria-label="Buscar documentos" />
        </label>
        {years.length > 1 && (
          <select value={year} onChange={(e) => setYear(e.target.value)} className="field !w-auto !rounded-full" aria-label="Ano">
            <option value="todos">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {/* meses com documento */}
      <div className="no-scrollbar -mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Meses">
        {['todos', ...months].map((m) => (
          <button key={m} role="tab" aria-selected={month === m} onClick={() => setMonth(m)} className={cn('shrink-0 rounded-full border px-4 py-2 text-xs transition', month === m ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
            {m === 'todos' ? 'Todos os meses' : monthLabel(m)}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum documento encontrado. Tente outro mês ou outra palavra.</p>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.month}>
              <h2 className="h-display mb-4 text-3xl text-wine">{monthLabel(g.month)}</h2>
              <ul className="space-y-3">
                {g.docs.map((d) => (
                  <li key={d.id} className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine"><FileText className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem]">{d.title}</span>
                      {d.description && <span className="mt-0.5 block text-sm text-ink/60">{d.description}</span>}
                      <span className="label mt-1 block text-ink/40">PDF{d.size_bytes ? ` · ${fmtSize(d.size_bytes)}` : ''}</span>
                    </span>
                    <span className="flex w-full gap-2 sm:w-auto">
                      <a href={`${base}/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-wine bg-wine px-5 py-2.5 text-[0.82rem] text-white transition hover:bg-wine-dark sm:flex-none">
                        <ExternalLink className="size-4" /> Abrir
                      </a>
                      <a href={`${base}/${d.id}?download=1`} aria-label={`Baixar ${d.title}`} className="inline-flex items-center justify-center rounded-full border border-wine px-4 py-2.5 text-wine transition hover:bg-wine hover:text-white">
                        <Download className="size-4" />
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
