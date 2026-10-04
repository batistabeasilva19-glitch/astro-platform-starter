'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Flag, FolderOpen, Heart, Lock, MessageCircle, Send, Smartphone, Stethoscope, Target, User, Users, Video, ShoppingBag, Sparkles, LayoutGrid, BarChart3, Handshake, type LucideIcon } from 'lucide-react';
import { saveSocialAnswers, submitSocialForm } from '@/lib/actions/social-form';
import { answeredCount, isAnswered, isVisible, missingRequired, sectionsFor, type Answers, type FormKind, type Question } from '@/lib/social-form/questions';
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

  const REVIEW = sections.length; // etapa extra: revisar e enviar
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
        try { localStorage.setItem(stepKey, String(si)); } catch {}
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

  const ICON: Record<string, LucideIcon> = { sobre: User, procedimentos: Stethoscope, servicos: ShoppingBag, objetivos: Target, publico: Users, perfil: Smartphone, gosto: Heart, voz: MessageCircle, producao: Video, materiais: FolderOpen, final: Flag, marca: Sparkles, pilares: LayoutGrid, metas: BarChart3, aprovacao: Handshake };
  const visibleQs = (i: number) => sections[i].questions.filter((q) => isVisible(q, answers));
  const secStat = (i: number) => {
    const qs = visibleQs(i);
    const done = qs.filter((q) => isAnswered(answers[q.id])).length;
    return { done, total: qs.length, pct: qs.length ? Math.round((done / qs.length) * 100) : 100, ok: qs.filter((q) => q.required).every((q) => isAnswered(answers[q.id])) };
  };
  const stat = sections.map((_, i) => secStat(i));
  const missing = missingRequired(answers, kind);
  const isReview = step === REVIEW;
  const s = isReview ? null : sections[step];
  const Icon = s ? (ICON[s.id] ?? ClipboardCheck) : ClipboardCheck;
  const status = { idle: 'Salvamento automático', saving: 'Salvando…', saved: 'Tudo salvo ♡', retry: 'Sem conexão — tentando de novo…', error: 'Não conseguimos salvar. Suas respostas estão guardadas neste aparelho.' }[save];
  const cheer = prog.pct >= 100 ? 'Tudo respondido! Falta só revisar e enviar ♡' : prog.pct >= 75 ? 'Falta pouquinho!' : prog.pct >= 40 ? 'Você está indo muito bem!' : prog.pct > 0 ? 'Ótimo começo!' : 'Vamos começar?';
  const R = 28;
  const C = 2 * Math.PI * R;

  return (
    <div id="sf-top" className="[&_label]:font-medium">
      {/* topo (celular): progresso + etapas */}
      <div className="card sticky top-2 z-20 mb-6 space-y-3 !rounded-3xl px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-wine/15" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-wine transition-all duration-500" style={{ width: `${prog.pct}%` }} /></div>
          <span className="text-xs font-medium tabular-nums text-wine">{prog.pct}%</span>
          <span className={cn('text-[0.7rem]', save === 'error' || save === 'retry' ? 'text-wine' : 'text-ink/50')} aria-live="polite">{status}</span>
        </div>
        <nav aria-label="Etapas" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {sections.map((sec, i) => (
            <button key={sec.id} type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition', i === step ? 'border-wine bg-wine text-white' : stat[i].done && stat[i].ok ? 'border-wine/40 bg-blush text-wine' : 'border-wine/20 bg-white text-ink/65 hover:bg-blush')}>
              {stat[i].done === stat[i].total && stat[i].total > 0 && i !== step ? <Check className="size-3.5" /> : <span className="tabular-nums opacity-70">{i + 1}</span>}
              <span className="whitespace-nowrap">{sec.title}</span>
            </button>
          ))}
          <button type="button" onClick={() => go(REVIEW)} aria-current={isReview ? 'step' : undefined} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition', isReview ? 'border-wine bg-wine text-white' : 'border-wine/20 bg-white text-ink/65 hover:bg-blush')}><ClipboardCheck className="size-3.5" /> Revisar e enviar</button>
        </nav>
      </div>

      <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-10">
        {/* menu lateral (computador) */}
        <aside className="hidden lg:block">
          <div className="card sticky top-4 space-y-5 !rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <div className="relative size-16 shrink-0">
                <svg viewBox="0 0 64 64" className="size-16 -rotate-90"><circle cx="32" cy="32" r={R} fill="none" strokeWidth="6" className="stroke-wine/15" /><circle cx="32" cy="32" r={R} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-wine transition-all duration-700" strokeDasharray={C} strokeDashoffset={C - (C * prog.pct) / 100} /></svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-medium tabular-nums text-wine">{prog.pct}%</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-wine">{cheer}</p>
                <p className="text-xs text-ink/55">{prog.answered} de {prog.total} perguntas</p>
              </div>
            </div>
            <nav aria-label="Etapas" className="space-y-1">
              {sections.map((sec, i) => {
                const Ic = ICON[sec.id] ?? ClipboardCheck;
                const st = stat[i];
                const full = st.total > 0 && st.done === st.total;
                return (
                  <button key={sec.id} type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className={cn('group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition', i === step ? 'bg-wine text-white' : 'hover:bg-blush')}>
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', i === step ? 'bg-white/20' : full ? 'bg-wine text-white' : 'bg-blush text-wine')}>{full && i !== step ? <Check className="size-4" /> : <Ic className="size-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[0.82rem]', i === step ? 'font-medium' : 'text-ink/80')}>{sec.title}</span>
                      <span className={cn('block h-1 overflow-hidden rounded-full', i === step ? 'bg-white/25' : 'bg-wine/10')}><span className={cn('block h-full rounded-full transition-all duration-500', i === step ? 'bg-white' : 'bg-wine')} style={{ width: `${st.pct}%` }} /></span>
                    </span>
                    <span className={cn('text-[0.7rem] tabular-nums', i === step ? 'text-white/80' : 'text-ink/45')}>{st.done}/{st.total}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => go(REVIEW)} aria-current={isReview ? 'step' : undefined} className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[0.82rem] transition', isReview ? 'bg-wine font-medium text-white' : 'text-ink/80 hover:bg-blush')}>
                <span className={cn('flex size-8 items-center justify-center rounded-full', isReview ? 'bg-white/20' : 'bg-blush text-wine')}><ClipboardCheck className="size-4" /></span>
                Revisar e enviar
              </button>
            </nav>
            <p className={cn('text-xs', save === 'error' || save === 'retry' ? 'text-wine' : 'text-ink/50')} aria-live="polite">{status}</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          {step === 0 && (
            <p className="rounded-2xl bg-blush px-5 py-4 text-sm leading-relaxed text-wine">
              Responda no seu ritmo. Tudo é salvo sozinho e você pode voltar depois pelo mesmo link. Quanto mais detalhes, melhor o nosso planejamento. Campos com <span aria-hidden>*</span> são obrigatórios. <strong className="font-normal">Depois de enviar, o formulário trava</strong>; se precisar mudar algo, é só falar com a gente.
            </p>
          )}

          {s ? (
            <section key={s.id} aria-labelledby={`s-${s.id}`} className="animate-rise">
              <div className="mb-7 flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine"><Icon className="size-6" /></span>
                <div className="min-w-0">
                  <p className="label mb-1 text-wine/60">Etapa {step + 1} de {sections.length} · {stat[step].done}/{stat[step].total} respondidas</p>
                  <h3 id={`s-${s.id}`} className="text-2xl font-medium tracking-tight text-wine sm:text-3xl">{s.title}</h3>
                  {s.intro && <p className="mt-2 text-sm text-ink/60">{s.intro}</p>}
                </div>
              </div>
              <div className="space-y-7">
                {s.questions.filter((q) => isVisible(q, answers)).map((q) => <SocialQuestion key={q.id} q={q} answers={answers} set={set} toggle={toggle} error={errors.includes(q.id)} />)}
                {s.files && (
                  <div className="space-y-2 border-t border-wine/10 pt-7">
                    <h4 className="text-[0.95rem] font-medium text-ink">Arquivos e fotos</h4>
                    <p className="text-xs text-ink/50">Envie a identidade visual e o logo, fotos e referências. Os arquivos são salvos na hora.</p>
                    <div className="pt-3"><FileArea token={token} files={files} groups={s.files.filter((g) => g !== 'logo' || (isAnswered(answers.visual_identity) && answers.visual_identity !== 'Não tenho ainda'))} /></div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="animate-rise" aria-labelledby="s-review">
              <div className="mb-7 flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine"><ClipboardCheck className="size-6" /></span>
                <div>
                  <p className="label mb-1 text-wine/60">Última etapa</p>
                  <h3 id="s-review" className="text-2xl font-medium tracking-tight text-wine sm:text-3xl">Revisar e enviar</h3>
                  <p className="mt-2 text-sm text-ink/60">Confira como ficou cada etapa. Toque em uma para voltar e completar.</p>
                </div>
              </div>
              <ul className="space-y-2">
                {sections.map((sec, i) => {
                  const st = stat[i];
                  const Ic = ICON[sec.id] ?? ClipboardCheck;
                  const reqMissing = visibleQs(i).filter((q) => q.required && !isAnswered(answers[q.id])).length;
                  return (
                    <li key={sec.id}>
                      <button type="button" onClick={() => go(i)} className="flex w-full items-center gap-3 rounded-2xl border border-wine/15 bg-white px-4 py-3 text-left transition hover:bg-blush">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', st.done === st.total ? 'bg-wine text-white' : 'bg-blush text-wine')}>{st.done === st.total ? <Check className="size-4" /> : <Ic className="size-4" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{sec.title}</span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-wine/10"><span className="block h-full rounded-full bg-wine" style={{ width: `${st.pct}%` }} /></span>
                        </span>
                        <span className="text-right text-xs tabular-nums text-ink/55">{st.done}/{st.total}{reqMissing > 0 && <span className="block text-wine">{reqMissing} obrigatória{reqMissing > 1 ? 's' : ''} pendente{reqMissing > 1 ? 's' : ''}</span>}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-8 rounded-[2rem] border border-wine/20 bg-white p-6 text-center sm:p-8">
                {missing.length > 0 ? (
                  <p className="mb-4 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Faltam {missing.length} pergunta(s) obrigatória(s) (*). Toque em “Enviar” e levamos você até a primeira.</p>
                ) : (
                  <p className="mb-4 text-sm text-ink/65">Tudo certo para enviar! Depois do envio, as respostas ficam travadas.</p>
                )}
                <Button size="lg" onClick={submit} loading={pending}><Send className="size-4" /> Enviar respostas</Button>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-wine/10 pt-6">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft className="size-4" /> Anterior</Button>
            {!isReview && <Button size="lg" onClick={() => go(step + 1)}>{step === sections.length - 1 ? 'Revisar' : 'Próxima'} <ArrowRight className="size-4" /></Button>}
          </div>
          {!isReview && <p className="-mt-4 text-center text-xs text-ink/45">Pode pular e voltar depois: o envio só é feito na última etapa.</p>}
        </div>
      </div>
    </div>
  );
}
