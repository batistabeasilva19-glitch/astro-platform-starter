'use client';

import { Copy, Lock, LockOpen, Stethoscope, Store, Trash2 } from 'lucide-react';
import { deleteSocialForm, lockSocialForm, releaseSocialForm, sendSocialForm, setSocialFormKind } from '@/lib/actions/social-form';
import { Button } from '@/components/ui/Button';
import { useAct } from '@/components/extras/shared';
import { KIND_LABEL, answersToText, answeredCount, type Answers, type FormKind, type FormStatus } from '@/lib/social-form/questions';
import { fmtStamp } from '@/lib/utils';

/** Controles do formulário de perfil no admin: enviar, liberar edição, travar, copiar respostas e excluir. */
export function SocialFormAdmin({ clientId, status, kind, answers, submittedAt, submittedBy }: { clientId: string; status: FormStatus | null; kind: FormKind; answers: Answers; submittedAt: string | null; submittedBy: string | null }) {
  const { act, pending, toast } = useAct();
  const prog = answeredCount(answers, kind);

  if (!status) {
    return (
      <div className="card flex flex-col items-center gap-4 border-dashed px-6 py-12 text-center">
        <p className="text-2xl font-medium tracking-tight text-wine">Qual formulário enviar?</p>
        <p className="max-w-lg text-sm text-ink/60">Cada um tem perguntas pensadas para o tipo de negócio. Ao enviar, ele aparece no link do cliente para ele responder.</p>
        <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <button disabled={pending} onClick={() => act(() => sendSocialForm(clientId, 'clinic'), 'Formulário enviado ao cliente ♡')} className="flex flex-col items-center gap-2 rounded-3xl border border-wine/25 bg-white p-5 text-wine transition hover:bg-blush disabled:opacity-60">
            <Stethoscope className="size-6" />
            <span className="font-medium">Consultório / clínica</span>
            <span className="text-xs text-ink/55">Procedimentos, regras do conselho, pacientes, primeira consulta…</span>
          </button>
          <button disabled={pending} onClick={() => act(() => sendSocialForm(clientId, 'business'), 'Formulário enviado ao cliente ♡')} className="flex flex-col items-center gap-2 rounded-3xl border border-wine/25 bg-white p-5 text-wine transition hover:bg-blush disabled:opacity-60">
            <Store className="size-6" />
            <span className="font-medium">Outras empresas</span>
            <span className="text-xs text-ink/55">Produtos e serviços, preço, clientes, diferenciais…</span>
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="card flex flex-wrap items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className={status === 'submitted' ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800'}>{status === 'submitted' ? 'Respondido e travado' : 'Aguardando respostas'}</span>
          <span className="ml-3 rounded-full bg-blush px-2.5 py-0.5 text-xs text-wine">{KIND_LABEL[kind]}</span>
          <span className="ml-3 text-xs text-ink/55">{prog.answered}/{prog.total} perguntas respondidas</span>
        </p>
        {status === 'submitted' && submittedAt && <p className="mt-1 text-xs text-ink/55">Enviado por {submittedBy} em {fmtStamp(submittedAt)}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(answersToText(answers, kind)).then(() => toast('Respostas copiadas ♡'), () => toast('Não foi possível copiar.', 'error'))}><Copy className="size-3.5" /> Copiar respostas</Button>
      {status === 'open' && (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => act(() => setSocialFormKind(clientId, kind === 'clinic' ? 'business' : 'clinic'), 'Tipo alterado')}>Trocar para {kind === 'clinic' ? KIND_LABEL.business : KIND_LABEL.clinic}</Button>
      )}
      {status === 'submitted' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => act(() => releaseSocialForm(clientId), 'Edição liberada ao cliente ♡')}><LockOpen className="size-3.5" /> Liberar edição ao cliente</Button>
      ) : (
        <Button size="sm" variant="outline" loading={pending} onClick={() => act(() => lockSocialForm(clientId), 'Formulário travado')}><Lock className="size-3.5" /> Travar</Button>
      )}
      <Button size="sm" variant="danger" aria-label="Excluir formulário" onClick={() => confirm('Excluir o formulário e as respostas? Ele some do link do cliente.') && act(() => deleteSocialForm(clientId), 'Formulário excluído')}><Trash2 className="size-3.5" /></Button>
    </div>
  );
}
