'use client';

import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import type { ActivityLog, CommentRow } from '@/lib/types';
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
}: {
  comments: CommentRow[];
  viewer: 'admin' | 'client';
  onSend: (message: string, slide: number | null) => Promise<SubmitResult>;
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

  const submit = () => {
    const message = text.trim();
    if (!message) return;
    start(async () => {
      const res = await onSend(message, slideMode && slideIndex !== undefined ? slideIndex + 1 : null);
      if (!res.ok) return toast(res.error ?? 'Não foi possível enviar.', 'error');
      setText('');
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
            return (
              <li key={c.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
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
                  <p className="whitespace-pre-line">{c.message}</p>
                </div>
                <span className="mt-1 px-2 text-[0.68rem] text-ink/45">{fmtStamp(c.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3">
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
          placeholder={slideMode ? `Comentário sobre o slide ${(slideIndex ?? 0) + 1}…` : viewer === 'client' ? 'Escreva um comentário…' : 'Responder ao cliente…'}
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
