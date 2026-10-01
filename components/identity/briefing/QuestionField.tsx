'use client';

import { Check } from 'lucide-react';
import type { Answers, Question } from '@/lib/identity/briefing';
import { Input, Textarea } from '@/components/ui/Fields';
import { cn } from '@/lib/utils';

export const chip = (on: boolean) => cn('rounded-full border px-4 py-2 text-[0.82rem] transition active:scale-[0.97]', on ? 'border-wine bg-wine text-white' : 'border-wine/30 bg-white text-wine hover:bg-blush');

/** Uma pergunta do formulário (texto, parágrafo, escolha única ou múltipla). Usada no portal e no admin. */
export function QuestionField({ q, answers, set, toggle, error, disabled }: { q: Question; answers: Answers; set: (id: string, v: string | string[]) => void; toggle: (q: Question, opt: string) => void; error?: boolean; disabled?: boolean }) {
  return (
    <div id={`q-${q.id}`}>
      <label htmlFor={`f-${q.id}`} className="mb-2 block text-[0.95rem] leading-snug text-ink">
        {q.label} {q.required && <span className="text-wine" aria-label="obrigatório">*</span>}
      </label>
      {q.hint && <p className="-mt-1 mb-2 text-xs text-ink/50">{q.hint}</p>}
      {q.type === 'text' && <Input id={`f-${q.id}`} value={(answers[q.id] as string) ?? ''} disabled={disabled} onChange={(e) => set(q.id, e.target.value)} placeholder={q.placeholder} />}
      {q.type === 'textarea' && <Textarea id={`f-${q.id}`} rows={4} value={(answers[q.id] as string) ?? ''} disabled={disabled} onChange={(e) => set(q.id, e.target.value)} placeholder={q.placeholder} />}
      {q.type === 'select' && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.label}>
          {q.options!.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={answers[q.id] === o} disabled={disabled} onClick={() => set(q.id, answers[q.id] === o ? '' : o)} className={chip(answers[q.id] === o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      {q.type === 'multi' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={q.label}>
          {q.options!.map((o) => {
            const on = ((answers[q.id] as string[] | undefined) ?? []).includes(o);
            return (
              <button key={o} type="button" aria-pressed={on} disabled={disabled} onClick={() => toggle(q, o)} className={chip(on)}>
                {on && <Check className="mr-1 inline size-3.5" />}
                {o}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-wine">Esta pergunta é obrigatória.</p>}
    </div>
  );
}
