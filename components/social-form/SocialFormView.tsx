import { ExternalLink, FileText } from 'lucide-react';
import { FILE_GROUPS, LEGACY_QUESTIONS, decodeLink, isAnswered, isVisible, sectionsFor, type Answers, type FormKind, type Question } from '@/lib/social-form/questions';
import type { FileWithUrl } from './FileArea';

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

/** Respostas do formulário (somente leitura): usado no portal depois de enviado e no admin. */
export function SocialFormView({ answers, kind, files = [] }: { answers: Answers; kind: FormKind; files?: FileWithUrl[] }) {
  return (
    <div className="space-y-8">
      {sectionsFor(kind).map((s) => (
        <section key={s.id}>
          <h3 className="mb-3 text-xl font-medium tracking-tight text-wine">{s.title}</h3>
          <dl className="divide-y divide-wine/10 rounded-2xl border border-wine/15 bg-white">
            {s.questions.filter((q) => isVisible(q, answers)).map((q) => (
              <div key={q.id} className="px-4 py-3 sm:px-5">
                <dt className="text-xs text-ink/50">{q.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-ink"><Value q={q} v={answers[q.id]} /></dd>
              </div>
            ))}
            {s.files && files.some((f) => s.files!.includes(f.group)) && (
              <div className="px-4 py-3 sm:px-5">
                <dt className="text-xs text-ink/50">Arquivos enviados</dt>
                <dd className="mt-2 space-y-4">
                  {files.filter((f) => s.files!.includes(f.group)).length === 0 && <span className="text-sm text-ink/30">—</span>}
                  {FILE_GROUPS.filter((g) => s.files!.includes(g.id)).map((g) => ({ g, list: files.filter((f) => f.group === g.id) })).filter((x) => x.list.length).map(({ g, list }) => (
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
      ))}
      {LEGACY_QUESTIONS.some((q) => isAnswered(answers[q.id])) && (
        <section>
          <h3 className="mb-3 text-xl font-medium tracking-tight text-wine">Respostas anteriores</h3>
          <dl className="divide-y divide-wine/10 rounded-2xl border border-wine/15 bg-white">
            {LEGACY_QUESTIONS.filter((q) => isAnswered(answers[q.id])).map((q) => (
              <div key={q.id} className="px-4 py-3 sm:px-5"><dt className="text-xs text-ink/50">{q.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{answers[q.id]}</dd></div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
