import { isAnswered, sectionsFor, type Answers, type FormKind } from '@/lib/social-form/questions';

/** Respostas do formulário (somente leitura): usado no portal depois de enviado e no admin. */
export function SocialFormView({ answers, kind }: { answers: Answers; kind: FormKind }) {
  return (
    <div className="space-y-8">
      {sectionsFor(kind).map((s) => (
        <section key={s.id}>
          <h3 className="mb-3 text-xl font-medium tracking-tight text-wine">{s.title}</h3>
          <dl className="divide-y divide-wine/10 rounded-2xl border border-wine/15 bg-white">
            {s.questions.map((q) => {
              const v = answers[q.id];
              return (
                <div key={q.id} className="px-4 py-3 sm:px-5">
                  <dt className="text-xs text-ink/50">{q.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{isAnswered(v) ? (Array.isArray(v) ? v.join(' · ') : v) : <span className="text-ink/30">—</span>}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
