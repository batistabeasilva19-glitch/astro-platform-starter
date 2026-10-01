'use client';

import { useState } from 'react';
import { BRIEFING_SECTIONS, answeredCount, isAnswered, type Answers } from '@/lib/identity/briefing';
import type { SignedAsset } from '@/lib/identity/types';
import { ImageViewer } from '../ImageViewer';
import { cn } from '@/lib/utils';

/** Respostas do formulário em leitura (cliente depois de enviar; administradora; versões). */
export function BriefingSummary({ answers, references }: { answers: Answers; references: SignedAsset[] }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  const { answered, total } = answeredCount(answers);
  return (
    <div className="space-y-12">
      <p className="text-sm text-ink/60">{answered} de {total} perguntas respondidas</p>
      {BRIEFING_SECTIONS.map((s, i) => (
        <section key={s.id}>
          <p className="label mb-1 text-wine/60">{String(i + 1).padStart(2, '0')}</p>
          <h3 className="h-display mb-5 text-3xl text-wine">{s.title}</h3>
          <dl className="space-y-5">
            {s.questions.map((q) => {
              const a = answers[q.id];
              const ok = isAnswered(a);
              return (
                <div key={q.id}>
                  <dt className="text-xs text-wine/80">{q.label}</dt>
                  <dd className={cn('mt-1 whitespace-pre-line text-[0.95rem] leading-relaxed', ok ? 'text-ink/90' : 'text-ink/35')}>
                    {Array.isArray(a) && a.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {a.map((x) => (
                          <span key={x} className="rounded-full border border-wine/30 px-3 py-1 text-sm text-wine">{x}</span>
                        ))}
                      </span>
                    ) : ok ? (
                      a
                    ) : (
                      'Sem resposta'
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
      <section>
        <p className="label mb-1 text-wine/60">Fotos</p>
        <h3 className="h-display mb-5 text-3xl text-wine">Referências visuais</h3>
        {references.length === 0 ? (
          <p className="text-sm text-ink/45">Nenhuma foto enviada.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {references.map((r) => (
              <figure key={r.id}>
                <button onClick={() => setOpen(r)} className="group block w-full overflow-hidden rounded-2xl bg-blush">
                  <img src={r.url} alt={r.caption || r.file_name} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                </button>
                {r.caption && <figcaption className="mt-1.5 px-1 text-xs text-ink/60">{r.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
        <ImageViewer asset={open} onClose={() => setOpen(null)} />
      </section>
    </div>
  );
}
