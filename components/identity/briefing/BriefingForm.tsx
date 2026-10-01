'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ImagePlus, Loader2, Lock, Send, Trash2 } from 'lucide-react';
import { createReferenceUpload, registerReferenceAsset, removeReferenceAsset, saveBriefingAnswers, submitBriefing, updateReferenceCaption } from '@/lib/actions/identity-briefing';
import { BRIEFING_SECTIONS, REQUIRED_IDS, answeredCount, missingRequired, type Answers, type Question } from '@/lib/identity/briefing';
import type { SignedAsset, StageData } from '@/lib/identity/types';
import { MEDIA_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Sparkle } from '@/components/brand/Brand';
import { fmtStamp } from '@/lib/utils';
import { BriefingSummary } from './BriefingSummary';
import { QuestionField } from './QuestionField';

interface Props {
  token: string;
  stage: StageData;
  initial: Answers;
  references: SignedAsset[];
}

/** Formulário da marca no portal do cliente: salvamento automático, fotos de referência e envio. */
export function BriefingForm({ token, stage, initial, references }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const first = useRef(true);
  const editable = stage.status === 'awaiting';
  const prog = answeredCount(answers);

  // salva sozinho ~1s depois de parar de digitar
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!editable) return;
    setSave('saving');
    const t = setTimeout(async () => {
      const r = await saveBriefingAnswers(token, answers);
      setSave(r.ok ? 'saved' : 'error');
    }, 1000);
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
      setErrors([]);
      const miss = missingRequired(answers);
      if (miss.length) {
        setErrors(miss.map((q) => q.label));
        document.getElementById(`q-${miss[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const r = await submitBriefing(token, answers);
      if (!r.ok) return toast(r.error, 'error');
      toast('Formulário enviado. Obrigada! ♡');
      router.refresh();
    });

  // enviado: mostra as respostas e permite editar
  if (!editable) {
    return (
      <div className="space-y-10">
        <div className="animate-pop rounded-3xl bg-wine p-7 text-center text-white">
          <Sparkle className="mx-auto mb-2 size-5 text-blush" animate />
          <p className="script text-4xl sm:text-5xl">Formulário enviado ♡</p>
          {stage.approved_at && <p className="mt-2 text-sm text-white/80">Enviado por {stage.approved_by} em {fmtStamp(stage.approved_at)}</p>}
          <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-sm text-white/85"><Lock className="size-4 shrink-0" /> Suas respostas estão salvas e travadas. Se precisar alterar algo, fale com a Soltria que ela libera a edição.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a href={`/brand/review/${token}/briefing/pdf`} className="inline-flex items-center gap-2 rounded-full border border-white/50 px-6 py-2.5 text-[0.85rem] text-white transition hover:bg-white hover:text-wine"><Download className="size-4" /> Baixar uma cópia (PDF)</a>
          </div>
        </div>
        <BriefingSummary answers={answers} references={references} />
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
        <span className="min-w-20 text-right text-xs text-ink/50" aria-live="polite">
          {save === 'saving' ? 'Salvando…' : save === 'saved' ? 'Salvo ♡' : save === 'error' ? 'Não foi possível salvar' : 'Salvamento automático'}
        </span>
      </div>

      <p className="rounded-2xl bg-blush px-5 py-4 text-sm leading-relaxed text-wine">
        Responda no seu ritmo — suas respostas ficam salvas e você pode voltar depois pelo mesmo link. Só perguntamos sobre a <strong className="font-normal">marca</strong>; <strong className="font-normal">não pedimos telefone nem dados pessoais</strong>. Campos com <span aria-hidden>*</span> são obrigatórios.
      </p>

      {BRIEFING_SECTIONS.map((s, i) => (
        <section key={s.id} aria-labelledby={`s-${s.id}`} className="animate-rise">
          <p className="label mb-1 text-wine/60">{String(i + 1).padStart(2, '0')} / {String(BRIEFING_SECTIONS.length).padStart(2, '0')}</p>
          <h3 id={`s-${s.id}`} className="h-display text-3xl text-wine sm:text-4xl">{s.title}</h3>
          {s.intro && <p className="mt-2 text-sm text-ink/60">{s.intro}</p>}
          <div className="mt-7 space-y-7">
            {s.questions.map((q) => (
              <QuestionField key={q.id} q={q} answers={answers} set={set} toggle={toggle} error={errors.includes(q.label)} />
            ))}
          </div>
        </section>
      ))}

      <ReferenceUploader token={token} references={references} />

      <div className="rounded-[2rem] border border-wine/20 bg-white p-6 text-center sm:p-8">
        {errors.length > 0 && <p className="mb-4 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Responda as perguntas obrigatórias ({REQUIRED_IDS.length}) para enviar.</p>}
        <p className="mb-5 text-sm text-ink/65">Pronto para enviar? Depois de enviar, você ainda pode voltar e editar as respostas.</p>
        <Button size="lg" onClick={submit} loading={pending}><Send className="size-4" /> Enviar respostas</Button>
      </div>
    </div>
  );
}

/** Fotos de referência: o arquivo vai direto do celular do cliente para o Storage (URL assinada). */
function ReferenceUploader({ token, references }: { token: string; references: SignedAsset[] }) {
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(files: File[]) {
    for (const [i, f] of files.entries()) {
      setBusy(`Enviando ${i + 1} de ${files.length}…`);
      try {
        const r = await createReferenceUpload(token, { fileName: f.name, mime: f.type, size: f.size });
        if (!r.ok) throw new Error(r.error);
        const { error } = await createClient().storage.from(MEDIA_BUCKET).uploadToSignedUrl(r.path, r.uploadToken, f, { contentType: f.type });
        if (error) throw new Error(error.message);
        const reg = await registerReferenceAsset(token, { path: r.path, fileName: f.name, mime: f.type });
        if (!reg.ok) throw new Error(reg.error);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Falha no envio da foto.', 'error');
        break;
      }
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <section aria-labelledby="s-refs">
      <p className="label mb-1 text-wine/60">Fotos</p>
      <h3 id="s-refs" className="h-display text-3xl text-wine sm:text-4xl">Referências visuais</h3>
      <p className="mt-2 text-sm text-ink/60">Envie fotos e imagens que representem o que você imagina para a marca: cores, texturas, ambientes, marcas que admira. Pode escrever o que gostou em cada uma.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {references.map((r) => (
          <RefCard key={r.id} token={token} asset={r} />
        ))}
        <button type="button" disabled={!!busy} onClick={() => ref.current?.click()} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-wine/30 p-3 text-center text-xs text-wine transition hover:border-wine hover:bg-blush disabled:opacity-70">
          {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          {busy ?? 'Adicionar fotos'}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
      <p className="mt-3 text-xs text-ink/45">JPG, PNG ou WEBP · até 15 MB cada · até 30 fotos</p>
    </section>
  );
}

function RefCard({ token, asset }: { token: string; asset: SignedAsset }) {
  const router = useRouter();
  const toast = useToast();
  const [caption, setCaption] = useState(asset.caption);
  const [pending, start] = useTransition();
  return (
    <figure className="overflow-hidden rounded-2xl border border-wine/20 bg-white">
      <div className="relative aspect-[4/5] bg-blush">
        <img src={asset.url} alt={asset.caption || asset.file_name} className="size-full object-cover" loading="lazy" />
        <button
          aria-label="Remover foto"
          onClick={() =>
            start(async () => {
              const r = await removeReferenceAsset(token, asset.id);
              if (!r.ok) return toast(r.error, 'error');
              router.refresh();
            })
          }
          className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-wine transition hover:bg-wine hover:text-white"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={async () => caption !== asset.caption && (await updateReferenceCaption(token, asset.id, caption))}
        placeholder="O que você gostou aqui?"
        aria-label="Comentário sobre a foto"
        maxLength={300}
        className="w-full border-t border-wine/15 px-3 py-2 text-xs outline-none placeholder:text-ink/35 focus:bg-blush/40"
      />
    </figure>
  );
}
