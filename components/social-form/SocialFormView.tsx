import { SOCIAL_SECTIONS, isAnswered, isVisible, type Answers } from '@/lib/social-form/questions';

/** Respostas do formulário (somente leitura): usado no portal depois de enviado e no admin. */
export function SocialFormView({ answers }: { answers: Answers }) {
  return (
    <div className="space-y-8">
      {SOCIAL_SECTIONS.map((s) => {
        const qs = s.questions.filter((q) => isVisible(q, answers));
        return (
          <section key={s.id}>
            <h3 className="h-display mb-3 text-2xl text-wine">{s.title}</h3>
            <dl className="divide-y divide-wine/10 rounded-2xl border border-wine/15 bg-white">
              {qs.map((q) => {
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
        );
      })}
    </div>
  );
}
