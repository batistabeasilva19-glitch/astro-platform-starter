'use client';

import { Copy, Lock, LockOpen, Send, Trash2 } from 'lucide-react';
import { deleteSocialForm, lockSocialForm, releaseSocialForm, sendSocialForm } from '@/lib/actions/social-form';
import { Button } from '@/components/ui/Button';
import { useAct } from '@/components/extras/shared';
import { answersToText, answeredCount, type Answers, type FormStatus } from '@/lib/social-form/questions';
import { fmtStamp } from '@/lib/utils';

/** Controles do formulário de perfil no admin: enviar, liberar edição, travar, copiar respostas e excluir. */
export function SocialFormAdmin({ clientId, status, answers, submittedAt, submittedBy }: { clientId: string; status: FormStatus | null; answers: Answers; submittedAt: string | null; submittedBy: string | null }) {
  const { act, pending, toast } = useAct();
  const prog = answeredCount(answers);

  if (!status) {
    return (
      <div className="card flex flex-col items-center gap-4 border-dashed px-6 py-12 text-center">
        <p className="h-display text-2xl text-wine">Formulário ainda não enviado</p>
        <p className="max-w-md text-sm text-ink/60">Ao enviar, o formulário aparece no link do cliente para ele responder. Se a área for saúde (consultório, clínica), ele também descreve os procedimentos que realiza.</p>
        <Button onClick={() => act(() => sendSocialForm(clientId), 'Formulário enviado ao cliente ♡')} loading={pending}><Send className="size-4" /> Enviar formulário ao cliente</Button>
      </div>
    );
  }
  return (
    <div className="card flex flex-wrap items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className={status === 'submitted' ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800'}>{status === 'submitted' ? 'Respondido e travado' : 'Aguardando respostas'}</span>
          <span className="ml-3 text-xs text-ink/55">{prog.answered}/{prog.total} perguntas respondidas</span>
        </p>
        {status === 'submitted' && submittedAt && <p className="mt-1 text-xs text-ink/55">Enviado por {submittedBy} em {fmtStamp(submittedAt)}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(answersToText(answers)).then(() => toast('Respostas copiadas ♡'), () => toast('Não foi possível copiar.', 'error'))}><Copy className="size-3.5" /> Copiar respostas</Button>
      {status === 'submitted' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => act(() => releaseSocialForm(clientId), 'Edição liberada ao cliente ♡')}><LockOpen className="size-3.5" /> Liberar edição ao cliente</Button>
      ) : (
        <Button size="sm" variant="outline" loading={pending} onClick={() => act(() => lockSocialForm(clientId), 'Formulário travado')}><Lock className="size-3.5" /> Travar</Button>
      )}
      <Button size="sm" variant="danger" aria-label="Excluir formulário" onClick={() => confirm('Excluir o formulário e as respostas? Ele some do link do cliente.') && act(() => deleteSocialForm(clientId), 'Formulário excluído')}><Trash2 className="size-3.5" /></Button>
    </div>
  );
}
