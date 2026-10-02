'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Lock, Send } from 'lucide-react';
import { saveSocialAnswers, submitSocialForm } from '@/lib/actions/social-form';
import { answeredCount, condMet, isAnswered, isVisible, missingRequired, sectionsFor, type Answers, type FormKind, type Question } from '@/lib/social-form/questions';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Sparkle } from '@/components/brand/Brand';
import { fmtStamp, cn } from '@/lib/utils';
import { SocialQuestion } from './Fields';
import { FileArea, type FileWithUrl } from './FileArea';
import { SocialFormView } from './SocialFormView';

type Save = 'idle' | 'saving' | 'saved' | 'retry' | 'error';

/**
 * Formulário de perfil no portal do cliente, em etapas.
 * Nada se perde: salva sozinho, guarda uma cópia no aparelho, tenta de novo se a internet cair
 * e avisa antes de fechar a página com algo ainda não salvo.
 */
export function SocialForm({ token, kind, initial, updatedAt, files, submitted, submittedBy, submittedAt }: { token: string; kind: FormKind; initial: Answers; updatedAt: string; files: FileWithUrl[]; submitted: boolean; submittedBy: string | null; submittedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const sections = sectionsFor(kind);
  const backupKey = `sf-backup-${token.slice(0, 20)}`;
  const stepKey = `sf-step-${token.slice(0, 20)}`;

  const [answers, setAnswers] = useState<Answers>(initial);
  const [step, setStep] = useState(0);
  const [save, setSave] = useState<Save>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startSubmit] = useTransition();
  const latest = useRef(answers);
  const dirty = useRef(false);
  const inflight = useRef(false);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prog = answeredCount(answers, kind);

  // recupera cópia local mais nova que a do servidor (ex.: a internet caiu antes de salvar) e a etapa em que parou
  useEffect(() => {
    if (submitted) return;
    try {
      const raw = localStorage.getItem(backupKey);
      if (raw) {
        const b = JSON.parse(raw) as { answers: Answers; ts: number };
        if (b.ts > new Date(updatedAt).getTime() && JSON.stringify(b.answers) !== JSON.stringify(initial)) {
          setAnswers({ ...initial, ...b.answers });
          dirty.current = true;
          toast('Recuperamos respostas que ainda não tinham sido salvas ♡');
          schedule(300);
        }
      }
      const s = Number(localStorage.getItem(stepKey));
      if (Number.isInteger(s) && s >= 0 && s < sections.length) setStep(s);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(async () => {
    if (inflight.current || !dirty.current) return;
    inflight.current = true;
    dirty.current = false;
    setSave('saving');
    const snapshot = latest.current;
    let ok = false;
    try {
      ok = (await saveSocialAnswers(token, snapshot)).ok;
    } catch {
      ok = false;
    }
    inflight.current = false;
    if (ok) {
      attempts.current = 0;
      if (!dirty.current) {
        setSave('saved');
        try { localStorage.removeItem(backupKey); } catch {}
      } else void flush();
    } else {
      dirty.current = true;
      attempts.current += 1;
      setSave(attempts.current >= 4 ? 'error' : 'retry');
      schedule(Math.min(15000, 2000 * attempts.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function schedule(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), ms);
  }

  const change = (next: Answers) => {
    latest.current = next;
    setAnswers(next);
    dirty.current = true;
    setSave('saving');
    try { localStorage.setItem(backupKey, JSON.stringify({ answers: next, ts: Date.now() })); } catch {}
    schedule(800);
  };
  const set = (id: string, v: string | string[]) => change({ ...latest.current, [id]: v });
  const toggle = (q: Question, opt: string) => {
    const cur = (latest.current[q.id] as string[] | undefined) ?? [];
    set(q.id, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  // salva já ao trocar de aba do navegador / fechar, e avisa se algo ainda não foi salvo
  useEffect(() => {
    if (submitted) return;
    const hide = () => { if (document.visibilityState === 'hidden') void flush(); };
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || inflight.current) { void flush(); e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    window.addEventListener('beforeunload', warn);
    window.addEventListener('online', () => void flush());
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('beforeunload', warn);
    };
  }, [submitted, flush]);

  const go = (n: number) => {
    void flush();
    setStep(n);
    try { localStorage.setItem(stepKey, String(n)); } catch {}
    requestAnimationFrame(() => document.getElementById('sf-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submit = () =>
    startSubmit(async () => {
      const miss = missingRequired(answers, kind);
      setErrors(miss.map((q) => q.id));
      if (miss.length) {
        const si = sections.findIndex((s) => s.questions.some((q) => q.id === miss[0].id));
        setStep(si);
        toast(`Faltam ${miss.length} pergunta(s) obrigatória(s). Já levamos você até a primeira.`, 'error');
        setTimeout(() => document.getElementById(`q-${miss[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
        return;
      }
      dirty.current = true;
      inflight.current = false;
      const r = await submitSocialForm(token, latest.current);
      if (!r.ok) return toast(r.error, 'error');
      try { localStorage.removeItem(backupKey); } catch {}
      toast('Formulário enviado. Obrigada! ♡');
      router.refresh();
    });

  if (submitted) {
    return (
      <div className="space-y-10">
        <div className="animate-pop rounded-3xl bg-wine p-7 text-center text-white">
          <Sparkle className="mx-auto mb-2 size-5 text-blush" animate />
          <p className="text-3xl font-medium tracking-tight sm:text-4xl">Formulário enviado ♡</p>
          {submittedAt && <p className="mt-2 text-sm text-white/80">Enviado por {submittedBy} em {fmtStamp(submittedAt)}</p>}
          <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-sm text-white/85"><Lock className="size-4 shrink-0" /> Suas respostas estão salvas e travadas. Se precisar alterar algo, fale com a Soltria que ela libera a edição.</p>
        </div>
        <SocialFormView answers={answers} kind={kind} files={files} />
      </div>
    );
  }

  const s = sections[step];
  const last = step === sections.length - 1;
  const secDone = (i: number) => {
    const qs = sections[i].questions.filter((q) => isVisible(q, answers));
    const req = qs.filter((q) => q.required);
    return qs.some((q) => isAnswered(answers[q.id])) && req.every((q) => isAnswered(answers[q.id]));
  };
  const status = { idle: 'Salvamento automático', saving: 'Salvando…', saved: 'Tudo salvo ♡', retry: 'Sem conexão — tentando de novo…', error: 'Não conseguimos salvar. Suas respostas estão guardadas neste aparelho.' }[save];

  return (
    <div id="sf-top" className="space-y-8 [&_label]:font-medium">
      <div className="card sticky top-2 z-20 space-y-3 !rounded-3xl px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-wine/15" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-wine transition-all duration-500" style={{ width: `${prog.pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-ink/60">{prog.answered}/{prog.total} respondidas</span>
          <span className={cn('text-xs', save === 'error' || save === 'retry' ? 'text-wine' : 'text-ink/50')} aria-live="polite">{status}</span>
        </div>
        <nav aria-label="Etapas" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {sections.map((sec, i) => (
            <button key={sec.id} type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition', i === step ? 'border-wine bg-wine text-white' : secDone(i) ? 'border-wine/40 bg-blush text-wine' : 'border-wine/20 bg-white text-ink/65 hover:bg-blush')}>
              {secDone(i) && i !== step ? <Check className="size-3.5" /> : <span className="tabular-nums opacity-70">{i + 1}</span>}
              <span className="whitespace-nowrap">{sec.title}</span>
            </button>
          ))}
        </nav>
      </div>

      {step === 0 && (
        <p className="rounded-2xl bg-blush px-5 py-4 text-sm leading-relaxed text-wine">
          Responda no seu ritmo. Tudo é salvo sozinho e você pode voltar depois pelo mesmo link. Quanto mais detalhes, melhor o nosso planejamento. Campos com <span aria-hidden>*</span> são obrigatórios. <strong className="font-normal">Depois de enviar, o formulário trava</strong>; se precisar mudar algo, é só falar com a gente.
        </p>
      )}

      <section key={s.id} aria-labelledby={`s-${s.id}`} className="animate-rise">
        <p className="label mb-1 text-wine/60">Etapa {step + 1} de {sections.length}</p>
        <h3 id={`s-${s.id}`} className="text-2xl font-medium tracking-tight text-wine sm:text-3xl">{s.title}</h3>
        {s.intro && <p className="mt-2 text-sm text-ink/60">{s.intro}</p>}
        <div className="mt-7 space-y-7">
          {s.questions.filter((q) => isVisible(q, answers)).map((q) => <SocialQuestion key={q.id} q={q} answers={answers} set={set} toggle={toggle} error={errors.includes(q.id)} />)}
          {s.files && condMet(s.filesIf, answers) && (
            <div className="space-y-2 border-t border-wine/10 pt-7">
              <h4 className="text-[0.95rem] font-medium text-ink">{s.id === 'identidade' ? 'Anexe aqui a sua identidade visual e o logo' : 'Arquivos e fotos'}</h4>
              <p className="text-xs text-ink/50">{s.id === 'identidade' ? 'Logo, manual da marca, paleta, fontes: tudo no mesmo lugar. Os arquivos são salvos na hora.' : 'Envie fotos e referências. Os arquivos são salvos na hora.'}</p>
              <div className="pt-3"><FileArea token={token} files={files} groups={s.files} /></div>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-wine/10 pt-6">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft className="size-4" /> Anterior</Button>
        {last ? (
          <div className="text-right">
            {errors.length > 0 && <p className="mb-2 text-xs text-wine">Responda as perguntas obrigatórias (*) para enviar.</p>}
            <Button size="lg" onClick={submit} loading={pending}><Send className="size-4" /> Enviar respostas</Button>
          </div>
        ) : (
          <Button size="lg" onClick={() => go(step + 1)}>Próxima <ArrowRight className="size-4" /></Button>
        )}
      </div>
      {!last && <p className="-mt-4 text-center text-xs text-ink/45">Pode pular e voltar depois: o envio só é feito na última etapa.</p>}
    </div>
  );
}
