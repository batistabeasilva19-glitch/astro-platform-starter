'use client';

import { useState, useTransition } from 'react';
import { CornerUpLeft, Send, SmilePlus, X } from 'lucide-react';
import type { ActivityLog, CommentRow, Reaction } from '@/lib/types';
import { REACTION_EMOJIS, cleanReactions, toggleReaction } from '@/lib/reactions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface SubmitResult {
  ok: boolean;
  error?: string;
}

/**
 * Conversa do conteúdo (cliente ⇄ administradora). Reutilizada no painel e no portal.
 * `onSend` recebe a mensagem e o slide opcional.
 */
export function CommentThread({
  comments,
  viewer,
  onSend,
  slideCount = 0,
  slideIndex,
  onPickSlide,
  versionNumbers,
  onReact,
  canReply,
}: {
  comments: CommentRow[];
  viewer: 'admin' | 'client';
  onSend: (message: string, slide: number | null, replyTo?: string | null) => Promise<SubmitResult>;
  /** reagir com emoji a um comentário (se omitido, as reações ficam escondidas). */
  onReact?: (commentId: string, emoji: string) => Promise<SubmitResult>;
  /** permite responder a um comentário específico. */
  canReply?: boolean;
  slideCount?: number;
  /** slide ativo no carrossel (0-based) — usado para comentar em um slide específico. */
  slideIndex?: number;
  onPickSlide?: (index: number) => void;
  versionNumbers?: Record<string, number>;
}) {
  const [text, setText] = useState('');
  const [slideMode, setSlideMode] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Reaction[]>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const byId = new Map(comments.map((c) => [c.id, c]));
  const reactionsOf = (c: CommentRow) => local[c.id] ?? cleanReactions(c.reactions);

  const react = (c: CommentRow, emoji: string) => {
    if (!onReact) return;
    const next = toggleReaction(reactionsOf(c), emoji, viewer);
    setLocal((l) => ({ ...l, [c.id]: next }));
    setPicker(null);
    start(async () => {
      const r = await onReact(c.id, emoji);
      if (!r.ok) {
        setLocal((l) => { const { [c.id]: _, ...rest } = l; void _; return rest; });
        return toast(r.error ?? 'Não foi possível reagir.', 'error');
      }
      router.refresh();
    });
  };
  const jump = (id: string) => {
    document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(id);
    setTimeout(() => setFlash(null), 1600);
  };

  const submit = () => {
    const message = text.trim();
    if (!message) return;
    start(async () => {
      const res = await onSend(message, slideMode && slideIndex !== undefined ? slideIndex + 1 : null, replyTo?.id ?? null);
      if (!res.ok) return toast(res.error ?? 'Não foi possível enviar.', 'error');
      setText('');
      setReplyTo(null);
      setSlideMode(false);
      toast(viewer === 'client' ? 'Comentário enviado ♡' : 'Mensagem enviada');
      router.refresh();
    });
  };

  return (
    <section aria-label="Comentários">
      <h3 className="label mb-4 text-wine">Comentários</h3>

      {comments.length === 0 ? (
        <p className="mb-5 rounded-2xl bg-blush/60 px-4 py-5 text-center text-sm text-ink/60">
          {viewer === 'client' ? 'Nenhum comentário ainda. Fique à vontade para escrever. ♡' : 'Nenhum comentário ainda.'}
        </p>
      ) : (
        <ul className="mb-5 space-y-3">
          {comments.map((c) => {
            const mine = c.author_type === viewer;
            const parent = c.reply_to ? byId.get(c.reply_to) : undefined;
            const rx = reactionsOf(c);
            const groups = REACTION_EMOJIS.map((e) => ({ e, n: rx.filter((r) => r.emoji === e).length, mine: rx.some((r) => r.emoji === e && r.by === viewer), who: rx.filter((r) => r.emoji === e).map((r) => (r.by === 'admin' ? 'Soltria' : 'Cliente')).join(', ') })).filter((g) => g.n > 0);
            return (
              <li id={`c-${c.id}`} key={c.id} className={cn('flex flex-col rounded-3xl transition-colors duration-700', mine ? 'items-end' : 'items-start', flash === c.id && 'bg-wine/10')}>
                <div
                  className={cn(
                    'max-w-[92%] rounded-3xl px-4 py-3 text-[0.9rem] leading-relaxed',
                    c.author_type === 'client' ? 'bg-blush text-ink' : 'border border-wine/20 bg-white text-ink',
                    mine ? 'rounded-br-lg' : 'rounded-bl-lg',
                  )}
                >
                  <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] uppercase tracking-[0.14em] text-wine">
                    <span className="font-normal">{c.author_type === 'client' ? 'Cliente' : 'Admin'} · {c.author_name}</span>
                    {c.is_change_request && <span className="rounded-full border border-wine px-2 py-0.5 normal-case tracking-normal">pedido de alteração</span>}
                    {c.slide_index && (
                      <button
                        onClick={() => onPickSlide?.(c.slide_index! - 1)}
                        className="rounded-full bg-wine px-2 py-0.5 normal-case tracking-normal text-white hover:bg-wine-dark"
                      >
                        Slide {c.slide_index}
                      </button>
                    )}
                    {c.version_id && versionNumbers?.[c.version_id] && (
                      <span className="normal-case tracking-normal text-ink/40">v{String(versionNumbers[c.version_id]).padStart(2, '0')}</span>
                    )}
                  </p>
                  {parent && (
                    <button type="button" onClick={() => jump(parent.id)} className="mb-2 block w-full rounded-2xl border-l-4 border-wine/50 bg-white/70 px-3 py-1.5 text-left text-xs text-ink/65 hover:bg-white">
                      <span className="block text-[0.65rem] uppercase tracking-wider text-wine">Respondendo a {parent.author_name}</span>
                      <span className="line-clamp-2">{parent.message}</span>
                    </button>
                  )}
                  <p className="whitespace-pre-line">{c.message}</p>
                </div>
                {(onReact || canReply) && (
                  <div className={cn('relative mt-1 flex flex-wrap items-center gap-1 px-1', mine ? 'justify-end' : 'justify-start')}>
                    {groups.map((g) => (
                      <button key={g.e} type="button" disabled={!onReact} title={g.who} onClick={() => react(c, g.e)} className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition', g.mine ? 'border-wine bg-blush' : 'border-wine/20 bg-white hover:bg-blush')}>
                        <span>{g.e}</span>{g.n > 1 && <span className="tabular-nums text-ink/60">{g.n}</span>}
                      </button>
                    ))}
                    {onReact && (
                      <span className="relative">
                        <button type="button" aria-label="Reagir com emoji" onClick={() => setPicker(picker === c.id ? null : c.id)} className="rounded-full p-1.5 text-wine/50 transition hover:bg-blush hover:text-wine"><SmilePlus className="size-4" /></button>
                        {picker === c.id && (
                          <span className={cn('absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border border-wine/20 bg-white p-1 shadow-lg', mine ? 'right-0' : 'left-0')}>
                            {REACTION_EMOJIS.map((e) => <button key={e} type="button" onClick={() => react(c, e)} className="rounded-full px-1.5 py-1 text-lg transition hover:scale-125 hover:bg-blush">{e}</button>)}
                          </span>
                        )}
                      </span>
                    )}
                    {canReply && (
                      <button type="button" onClick={() => { setReplyTo(c); document.getElementById('thread-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-wine/70 transition hover:bg-blush hover:text-wine"><CornerUpLeft className="size-3.5" /> Responder</button>
                    )}
                  </div>
                )}
                <span className="mt-1 px-2 text-[0.68rem] text-ink/45">{fmtStamp(c.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div id="thread-composer" className="space-y-3">
        {replyTo && (
          <div className="flex items-start gap-2 rounded-2xl border-l-4 border-wine bg-blush/60 px-3 py-2 text-xs">
            <CornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-wine" />
            <span className="min-w-0 flex-1"><span className="block text-wine">Respondendo a {replyTo.author_name}</span><span className="line-clamp-2 text-ink/65">{replyTo.message}</span></span>
            <button type="button" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)} className="rounded-full p-1 text-wine/60 hover:bg-white hover:text-wine"><X className="size-3.5" /></button>
          </div>
        )}
        {slideCount > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setSlideMode(false)}
              className={cn('rounded-full border px-3 py-1.5 transition', !slideMode ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}
            >
              Comentário geral
            </button>
            <button
              onClick={() => setSlideMode(true)}
              className={cn('rounded-full border px-3 py-1.5 transition', slideMode ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}
            >
              Comentar no slide {(slideIndex ?? 0) + 1}
            </button>
            {slideMode && <span className="text-ink/50">(deslize o carrossel para trocar de slide)</span>}
          </div>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={replyTo ? `Respondendo a ${replyTo.author_name}…` : slideMode ? `Comentário sobre o slide ${(slideIndex ?? 0) + 1}…` : viewer === 'client' ? 'Escreva um comentário…' : 'Responder ao cliente…'}
        />
        <div className="flex justify-end">
          <Button onClick={submit} loading={pending} disabled={!text.trim()} size="sm">
            <Send className="size-3.5" /> Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}

const ACTION_LABEL: Record<string, string> = {
  created: 'Conteúdo criado',
  sent: 'Enviado para aprovação',
  approved: 'Cliente aprovou',
  changes_requested: 'Cliente solicitou alteração',
  new_version: 'Nova versão adicionada',
};

export function HistoryList({ history }: { history: ActivityLog[] }) {
  if (!history.length) return null;
  return (
    <section aria-label="Histórico">
      <h3 className="label mb-4 text-wine">Histórico</h3>
      <ol className="relative space-y-4 border-l border-wine/20 pl-5">
        {history.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-[1.6rem] top-1.5 size-2 rounded-full bg-wine" />
            <p className="text-sm">
              <span className="font-normal text-wine">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(h.created_at))}</span>{' '}
              — {h.detail || ACTION_LABEL[h.action] || h.action}
            </p>
            <p className="text-[0.7rem] text-ink/45">
              {fmtStamp(h.created_at)}
              {h.actor_name ? ` · ${h.actor_name}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
