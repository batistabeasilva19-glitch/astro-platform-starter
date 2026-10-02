'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Send } from 'lucide-react';
import { saveSocialAnswers, submitSocialForm } from '@/lib/actions/social-form';
import { SOCIAL_SECTIONS, answeredCount, isVisible, missingRequired, type Answers, type Question } from '@/lib/social-form/questions';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Sparkle } from '@/components/brand/Brand';
import { QuestionField } from '@/components/identity/briefing/QuestionField';
import { SocialFormView } from './SocialFormView';
import { fmtStamp } from '@/lib/utils';

/** Formulário de perfil no portal do cliente: salvamento automático, envio e trava depois de enviado. */
export function SocialForm({ token, initial, submitted, submittedBy, submittedAt }: { token: string; initial: Answers; submitted: boolean; submittedBy: string | null; submittedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const first = useRef(true);
  const prog = answeredCount(answers);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (submitted) return;
    setSave('saving');
    const t = setTimeout(async () => setSave((await saveSocialAnswers(token, answers)).ok ? 'saved' : 'error'), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  const set = (id: string, v: string | string[]) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggle = (q: Question, opt: string) => {
    const cur = (answers[q.id] as string[] | undefined) ?? [];
    set(q.id, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };
  const submit = () =>
    start(async () => {
      const miss = missingRequired(answers);
      setErrors(miss.map((q) => q.id));
      if (miss.length) {
        document.getElementById(`q-${miss[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const r = await submitSocialForm(token, answers);
      if (!r.ok) return toast(r.error, 'error');
      toast('Formulário enviado. Obrigada! ♡');
      router.refresh();
    });

  if (submitted) {
    return (
      <div className="space-y-10">
        <div className="animate-pop rounded-3xl bg-wine p-7 text-center text-white">
          <Sparkle className="mx-auto mb-2 size-5 text-blush" animate />
          <p className="script text-4xl sm:text-5xl">Formulário enviado ♡</p>
          {submittedAt && <p className="mt-2 text-sm text-white/80">Enviado por {submittedBy} em {fmtStamp(submittedAt)}</p>}
          <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-sm text-white/85"><Lock className="size-4 shrink-0" /> Suas respostas estão salvas e travadas. Se precisar alterar algo, fale com a Soltria que ela libera a edição.</p>
        </div>
        <SocialFormView answers={answers} />
      </div>
    );
  }

  return (
    <div className="space-y-14">
      <div className="card sticky top-16 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 !rounded-full px-5 py-3">
        <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-wine/15" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-wine transition-all duration-500" style={{ width: `${prog.pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-ink/60">{prog.answered}/{prog.total}</span>
        <span className="min-w-20 text-right text-xs text-ink/50" aria-live="polite">{save === 'saving' ? 'Salvando…' : save === 'saved' ? 'Salvo ♡' : save === 'error' ? 'Não foi possível salvar' : 'Salvamento automático'}</span>
      </div>

      <p className="rounded-2xl bg-blush px-5 py-4 text-sm leading-relaxed text-wine">
        Responda no seu ritmo: suas respostas ficam salvas e você pode voltar depois pelo mesmo link. Quanto mais detalhes, melhor o nosso planejamento. Campos com <span aria-hidden>*</span> são obrigatórios. <strong className="font-normal">Depois de enviar, o formulário trava</strong>; se precisar mudar algo, é só falar com a gente.
      </p>

      {SOCIAL_SECTIONS.map((s, i) => {
        const qs = s.questions.filter((q) => isVisible(q, answers));
        if (!qs.length) return null;
        return (
          <section key={s.id} aria-labelledby={`s-${s.id}`} className="animate-rise">
            <p className="label mb-1 text-wine/60">{String(i + 1).padStart(2, '0')} / {String(SOCIAL_SECTIONS.length).padStart(2, '0')}</p>
            <h3 id={`s-${s.id}`} className="h-display text-3xl text-wine sm:text-4xl">{s.title}</h3>
            {s.intro && <p className="mt-2 text-sm text-ink/60">{s.intro}</p>}
            <div className="mt-7 space-y-7">
              {qs.map((q) => <QuestionField key={q.id} q={q} answers={answers} set={set} toggle={toggle} error={errors.includes(q.id)} />)}
            </div>
          </section>
        );
      })}

      <div className="rounded-[2rem] border border-wine/20 bg-white p-6 text-center sm:p-8">
        {errors.length > 0 && <p className="mb-4 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Responda as perguntas obrigatórias (marcadas com *) para enviar.</p>}
        <p className="mb-5 text-sm text-ink/65">Pronto para enviar? Depois do envio, as respostas ficam travadas.</p>
        <Button size="lg" onClick={submit} loading={pending}><Send className="size-4" /> Enviar respostas</Button>
      </div>
    </div>
  );
}
