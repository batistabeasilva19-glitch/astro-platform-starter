'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil } from 'lucide-react';
import { approveStage, requestStageChanges } from '@/lib/actions/identity-portal';
import { STAGE_BY_KEY, type StageKey, type StageStatus } from '@/lib/identity/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormMessage, Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { Sparkle } from '@/components/brand/Brand';
import { fmtStamp } from '@/lib/utils';

const APPROVE_LABEL: Record<StageKey, string> = {
  concept: 'Aprovar conceito',
  moodboard: 'Aprovar moodboard',
  logo: 'Aprovar logo',
  colors: 'Aprovar cores',
  typography: 'Aprovar tipografia',
  elements: 'Aprovar elementos',
  applications: 'Aprovar aplicações',
  final: 'Aprovar identidade visual',
  files: 'Aprovar',
};

interface Props {
  token: string;
  stageId: string;
  stageKey: StageKey;
  versionId: string;
  versionNumber: number;
  status: StageStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  isCurrent: boolean;
  /** logo: só é possível aprovar depois de escolher uma proposta. */
  needsChoice?: boolean;
}

export function IdentityApproval({ token, stageId, stageKey, versionId, versionNumber, status, approvedBy, approvedAt, isCurrent, needsChoice }: Props) {
  const [modal, setModal] = useState<'approve' | 'change' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const label = STAGE_BY_KEY[stageKey].label;
  const v = String(versionNumber).padStart(2, '0');

  if (status === 'approved') {
    return (
      <div className="animate-pop rounded-3xl bg-wine p-6 text-center text-white">
        <Sparkle className="mx-auto mb-2 size-5 text-blush" animate />
        <p className="script text-4xl">{stageKey === 'final' ? 'Identidade aprovada ♡' : `${label} aprovado ♡`}</p>
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
  if (status !== 'awaiting' || !isCurrent) return null;

  const approve = () =>
    start(async () => {
      const r = await approveStage(token, stageId, versionId);
      setModal(null);
      if (!r.ok) return toast(r.error, 'error');
      toast(stageKey === 'final' ? 'Identidade visual aprovada ♡' : `${label} aprovado ♡`);
      router.refresh();
    });
  const send = () =>
    start(async () => {
      setError(null);
      const r = await requestStageChanges(token, stageId, versionId, message);
      if (!r.ok) return setError(r.error);
      setModal(null);
      setMessage('');
      toast('Solicitação enviada. Obrigada! ♡');
      router.refresh();
    });

  return (
    <>
      {needsChoice && <p className="mb-3 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Escolha uma das propostas para poder aprovar o logo.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" className="py-4" onClick={() => setModal('approve')} disabled={needsChoice}>
          <Check className="size-4" /> {APPROVE_LABEL[stageKey]}
        </Button>
        <Button size="lg" variant="outline" className="py-4" onClick={() => setModal('change')}>
          <Pencil className="size-4" /> Solicitar alteração
        </Button>
      </div>

      <Modal open={modal === 'approve'} onClose={() => setModal(null)} title={APPROVE_LABEL[stageKey]}>
        <p className="mb-2 text-[0.95rem]">{stageKey === 'final' ? 'Tem certeza que deseja aprovar a identidade visual completa?' : 'Tem certeza que deseja aprovar esta etapa?'}</p>
        {stageKey !== 'final' && <p className="mb-1 text-sm text-ink/60">Etapa: <strong className="font-normal text-wine">{label}</strong></p>}
        <p className="mb-6 text-sm text-ink/60">Você está aprovando a <strong className="font-normal text-wine">Versão {v} (versão atual)</strong>.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setModal(null)}>Voltar</Button>
          <Button onClick={approve} loading={pending}><Check className="size-4" /> Sim, aprovar</Button>
        </div>
      </Modal>

      <Modal open={modal === 'change'} onClose={() => setModal(null)} title="Solicitar alteração">
        <label className="label mb-2 block text-wine" htmlFor="idn-change">O que você gostaria de alterar?</label>
        <Textarea id="idn-change" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte com suas palavras." autoFocus />
        <div className="mt-3"><FormMessage error={error} /></div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={send} loading={pending} disabled={!message.trim()}>Enviar solicitação</Button>
        </div>
      </Modal>
    </>
  );
}
