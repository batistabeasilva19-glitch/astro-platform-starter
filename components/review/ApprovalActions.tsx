'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil } from 'lucide-react';
import { approveContent, requestChanges } from '@/lib/actions/portal';
import { AWAITING } from '@/lib/constants';
import type { ContentFormat, ContentStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormMessage, Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { Sparkle } from '@/components/brand/Brand';
import { fmtStamp } from '@/lib/utils';

interface Props {
  token: string;
  contentId: string;
  versionId: string;
  versionNumber: number;
  format: ContentFormat;
  status: ContentStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  /** false quando o cliente está vendo uma versão anterior. */
  isCurrent: boolean;
}

export function ApprovalActions({ token, contentId, versionId, versionNumber, format, status, approvedBy, approvedAt, isCurrent }: Props) {
  const [modal, setModal] = useState<'approve' | 'change' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const v = String(versionNumber).padStart(2, '0');

  if (status === 'approved' || status === 'scheduled' || status === 'published') {
    return (
      <div className="animate-pop rounded-3xl bg-wine p-6 text-center text-white">
        <Sparkle className="mx-auto mb-2 size-5 text-blush" animate />
        <p className="script text-4xl">Conteúdo aprovado ♡</p>
        {approvedAt && <p className="mt-2 text-sm text-white/80">Aprovado por {approvedBy} em {fmtStamp(approvedAt)}</p>}
      </div>
    );
  }
  if (status === 'changes_requested') {
    return (
      <div className="rounded-3xl border border-dashed border-wine p-6 text-center">
        <p className="h-display text-2xl text-wine">Solicitação enviada ✎</p>
        <p className="mt-1 text-sm text-ink/65">Já recebemos seu pedido de alteração. Assim que a nova versão estiver pronta, você poderá revisar aqui.</p>
      </div>
    );
  }
  if (!AWAITING.includes(status)) return null;
  if (!isCurrent) return null;

  const approve = () =>
    start(async () => {
      const r = await approveContent(token, contentId, versionId);
      if (!r.ok) {
        setModal(null);
        return toast(r.error, 'error');
      }
      setModal(null);
      toast('Conteúdo aprovado ♡');
      router.refresh();
    });

  const send = () =>
    start(async () => {
      setError(null);
      const r = await requestChanges(token, contentId, versionId, message);
      if (!r.ok) return setError(r.error);
      setModal(null);
      setMessage('');
      toast('Solicitação enviada. Obrigada! ♡');
      router.refresh();
    });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => setModal('approve')} className="!whitespace-normal py-4 text-center !tracking-[0.08em] max-sm:!px-4 max-sm:!text-[0.8rem]">
          <Check className="size-4" /> {format === 'carousel' ? 'Aprovar carrossel completo' : 'Aprovar conteúdo'}
        </Button>
        <Button size="lg" variant="outline" onClick={() => setModal('change')} className="!whitespace-normal py-4 text-center !tracking-[0.08em] max-sm:!px-4 max-sm:!text-[0.8rem]">
          <Pencil className="size-4" /> Solicitar alteração
        </Button>
      </div>

      <Modal open={modal === 'approve'} onClose={() => setModal(null)} title="Aprovar conteúdo">
        <p className="mb-2 text-[0.95rem]">Tem certeza que deseja aprovar este conteúdo?</p>
        <p className="mb-6 text-sm text-ink/60">Você está aprovando a <strong className="font-normal text-wine">Versão {v} (versão atual)</strong>.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setModal(null)}>Voltar</Button>
          <Button onClick={approve} loading={pending}><Check className="size-4" /> Sim, aprovar</Button>
        </div>
      </Modal>

      <Modal open={modal === 'change'} onClose={() => setModal(null)} title="Solicitar alteração">
        <label className="label mb-2 block text-wine" htmlFor="change-msg">O que você gostaria de alterar?</label>
        <Textarea id="change-msg" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte com suas palavras. Pode ser o texto, a arte, a cor…" autoFocus />
        <div className="mt-3"><FormMessage error={error} /></div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={send} loading={pending} disabled={!message.trim()}>Enviar solicitação</Button>
        </div>
      </Modal>
    </>
  );
}
