'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, FileText, Link2, Paperclip } from 'lucide-react';
import { FILE_GROUPS, LEGACY_QUESTIONS, decodeLink, isAnswered, isVisible, sectionsFor, type Answers, type FormKind, type Question } from '@/lib/social-form/questions';
import type { FileWithUrl } from './FileArea';
import { cn } from '@/lib/utils';

const href = (u: string) => (/^https?:\/\//i.test(u) ? u : /^[\w.-]+\.[a-z]{2,}/i.test(u) ? `https://${u}` : null);

function Value({ q, v }: { q: Question; v: string | string[] | undefined }) {
  if (!isAnswered(v)) return <span className="text-ink/30">—</span>;
  if (q.type === 'links')
    return (
      <ul className="space-y-1">
        {(v as string[]).map((raw, i) => {
          const l = decodeLink(raw);
          const h = href(l.url);
          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blush px-2.5 py-0.5 text-xs text-wine">{l.kind}</span>
              {h ? <a href={h} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all text-wine underline-offset-2 hover:underline">{l.url} <ExternalLink className="size-3 shrink-0" /></a> : <span className="break-all">{l.url}</span>}
            </li>
          );
        })}
      </ul>
    );
  if (q.type === 'list') return <ul className="list-disc space-y-0.5 pl-5">{(v as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>;
  if (q.type === 'colors') return <div className="flex flex-wrap gap-2">{(v as string[]).map((c) => <span key={c} className="flex items-center gap-1.5 rounded-full border border-wine/15 py-0.5 pl-0.5 pr-2 text-xs"><i className="size-5 rounded-full ring-1 ring-ink/15" style={{ background: c }} /><span className="font-mono uppercase">{c}</span></span>)}</div>;
  if (q.type === 'scale') return <span>{v}/5 <span className="text-xs text-ink/45">({q.scale?.[0]} → {q.scale?.[1]})</span></span>;
  return <>{Array.isArray(v) ? v.join(' · ') : v}</>;
}

const plain = (q: Question, v: string | string[] | undefined) => {
  if (!isAnswered(v)) return '';
  if (q.type === 'links') return (v as string[]).map((r) => { const l = decodeLink(r); return `${l.kind}: ${l.url}`; }).join('\n');
  if (q.type === 'list') return (v as string[]).join('\n');
  if (q.type === 'scale') return `${v}/5`;
  return Array.isArray(v) ? v.join(', ') : String(v);
};

/** Respostas do formulário (somente leitura): menu lateral com progresso, filtro e copiar por resposta. */
export function SocialFormView({ answers, kind, files = [] }: { answers: Answers; kind: FormKind; files?: FileWithUrl[] }) {
  const sections = sectionsFor(kind);
  const [sel, setSel] = useState<string>('all');
  const [only, setOnly] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const stat = (id: string) => {
    const sec = sections.find((x) => x.id === id)!;
    const qs = sec.questions.filter((q) => isVisible(q, answers));
    const done = qs.filter((q) => isAnswered(answers[q.id])).length;
    const nf = sec.files ? files.filter((f) => sec.files!.includes(f.group)).length : 0;
    return { done, total: qs.length, pct: qs.length ? Math.round((done / qs.length) * 100) : 0, nf };
  };
  const all = sections.reduce((n, sec) => { const st = stat(sec.id); return { done: n.done + st.done, total: n.total + st.total }; }, { done: 0, total: 0 });
  const pct = all.total ? Math.round((all.done / all.total) * 100) : 0;
  const linksCount = (answers.links as string[] | undefined)?.length ?? 0;
  const shown = sel === 'all' ? sections : sections.filter((x) => x.id === sel);
  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500); } catch {}
  };

  return (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
      <aside className="mb-6 lg:mb-0">
        <div className="card space-y-4 !rounded-3xl p-4 lg:sticky lg:top-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-blush px-2 py-2"><p className="text-lg font-medium tabular-nums text-wine">{pct}%</p><p className="text-[0.65rem] text-ink/55">respondido</p></div>
            <div className="rounded-2xl bg-blush px-2 py-2"><p className="flex items-center justify-center gap-1 text-lg font-medium tabular-nums text-wine"><Link2 className="size-3.5" />{linksCount}</p><p className="text-[0.65rem] text-ink/55">links</p></div>
            <div className="rounded-2xl bg-blush px-2 py-2"><p className="flex items-center justify-center gap-1 text-lg font-medium tabular-nums text-wine"><Paperclip className="size-3.5" />{files.length}</p><p className="text-[0.65rem] text-ink/55">arquivos</p></div>
          </div>
          <nav aria-label="Etapas do formulário" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
            <button type="button" onClick={() => setSel('all')} className={cn('shrink-0 rounded-2xl px-3 py-2 text-left text-[0.82rem] transition lg:w-full', sel === 'all' ? 'bg-wine font-medium text-white' : 'text-ink/75 hover:bg-blush')}>Ver tudo</button>
            {sections.map((sec) => {
              const st = stat(sec.id);
              const full = st.total > 0 && st.done === st.total;
              return (
                <button key={sec.id} type="button" onClick={() => setSel(sec.id)} className={cn('shrink-0 rounded-2xl px-3 py-2 text-left transition lg:w-full', sel === sec.id ? 'bg-wine text-white' : 'hover:bg-blush')}>
                  <span className="flex items-center gap-2 text-[0.82rem]">
                    {full && <Check className="size-3.5 shrink-0" />}
                    <span className="min-w-0 flex-1 whitespace-nowrap lg:truncate">{sec.title}</span>
                    <span className={cn('text-[0.7rem] tabular-nums', sel === sec.id ? 'text-white/80' : 'text-ink/45')}>{st.done}/{st.total}</span>
                  </span>
                  <span className={cn('mt-1 hidden h-1 overflow-hidden rounded-full lg:block', sel === sec.id ? 'bg-white/25' : 'bg-wine/10')}><span className={cn('block h-full rounded-full', sel === sec.id ? 'bg-white' : 'bg-wine')} style={{ width: `${st.pct}%` }} /></span>
                </button>
              );
            })}
          </nav>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink/65"><input type="checkbox" className="size-4 accent-[#771430]" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Mostrar só o que foi respondido</label>
        </div>
      </aside>

      <div className="min-w-0 space-y-8">
        {shown.map((s) => {
          const st = stat(s.id);
          const qs = s.questions.filter((q) => isVisible(q, answers) && (!only || isAnswered(answers[q.id])));
          const sf = s.files ? files.filter((f) => s.files!.includes(f.group)) : [];
          return (
            <section key={s.id}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <h3 className="text-xl font-medium tracking-tight text-wine">{s.title}</h3>
                <span className="shrink-0 rounded-full bg-blush px-2.5 py-0.5 text-xs tabular-nums text-wine">{st.done}/{st.total} respondidas</span>
              </div>
              <dl className="divide-y divide-wine/10 overflow-hidden rounded-2xl border border-wine/15 bg-white">
                {qs.length === 0 && sf.length === 0 && <p className="px-5 py-4 text-sm text-ink/45">Nada respondido nesta etapa.</p>}
                {qs.map((q) => {
                  const v = answers[q.id];
                  const ok = isAnswered(v);
                  const text = plain(q, v);
                  return (
                    <div key={q.id} className={cn('group flex gap-3 px-4 py-3 sm:px-5', !ok && 'bg-ink/[0.02]')}>
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs text-ink/50">{q.label}</dt>
                        <dd className={cn('mt-1 whitespace-pre-wrap break-words text-sm', ok ? 'text-ink' : 'text-ink/30')}><Value q={q} v={v} /></dd>
                      </div>
                      {ok && (
                        <button type="button" aria-label="Copiar resposta" onClick={() => copy(q.id, text)} className="h-fit shrink-0 rounded-full p-2 text-wine/50 transition hover:bg-blush hover:text-wine">
                          {copied === q.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </button>
                      )}
                    </div>
                  );
                })}
                {sf.length > 0 && (
                  <div className="px-4 py-3 sm:px-5">
                    <dt className="text-xs text-ink/50">Arquivos enviados</dt>
                    <dd className="mt-2 space-y-4">
                      {FILE_GROUPS.filter((g) => s.files!.includes(g.id)).map((g) => ({ g, list: sf.filter((f) => f.group === g.id) })).filter((x) => x.list.length).map(({ g, list }) => (
                        <div key={g.id}>
                          <p className="mb-1.5 text-xs text-wine">{g.label} ({list.length})</p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {list.map((f) => (
                              <a key={f.id} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" title={f.caption || f.name} className="group block overflow-hidden rounded-xl border border-wine/15 bg-blush">
                                {f.url && f.mime.startsWith('image/') && !/svg/.test(f.mime) ? (
                                  <img src={f.url} alt={f.name} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                                ) : (
                                  <span className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-[0.65rem] text-wine"><FileText className="size-6" /><span className="line-clamp-2 break-all">{f.name}</span></span>
                                )}
                                {f.caption && <span className="block truncate px-2 py-1 text-[0.65rem] text-ink/60">{f.caption}</span>}
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          );
        })}
        {sel === 'all' && LEGACY_QUESTIONS.some((q) => isAnswered(answers[q.id])) && (
          <section>
            <h3 className="mb-3 text-xl font-medium tracking-tight text-wine">Respostas anteriores</h3>
            <dl className="divide-y divide-wine/10 rounded-2xl border border-wine/15 bg-white">
              {LEGACY_QUESTIONS.filter((q) => isAnswered(answers[q.id])).map((q) => (
                <div key={q.id} className="px-4 py-3 sm:px-5"><dt className="text-xs text-ink/50">{q.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).join(', ') : answers[q.id]}</dd></div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
