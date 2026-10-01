'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Trash2 } from 'lucide-react';
import { deleteIdentityProject, finalizeIdentityProject, regenerateIdentityLink, setIdentityLinkActive, setStageEnabled } from '@/lib/actions/identity';
import { LinkActions } from '@/components/admin/LinkActions';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

/** Link público da identidade (copiar / abrir / novo / revogar) — reutiliza o componente do módulo de conteúdo. */
export function IdentityLink({ projectId, url, active, clientId }: { projectId: string; url: string; active: boolean; clientId: string }) {
  return <LinkActions clientId={clientId} url={url} active={active} regenerate={() => regenerateIdentityLink(projectId)} setActive={(v) => setIdentityLinkActive(projectId, v)} />;
}

export function FinalizeButton({ projectId, finalized }: { projectId: string; finalized: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant={finalized ? 'outline' : 'dark'}
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await finalizeIdentityProject(projectId, !finalized);
          if (!r.ok) return toast(r.error ?? 'Erro', 'error');
          toast(finalized ? 'Projeto reaberto' : 'Projeto finalizado ♡');
          router.refresh();
        })
      }
    >
      <Flag className="size-3.5" /> {finalized ? 'Reabrir projeto' : 'Finalizar projeto'}
    </Button>
  );
}

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> Excluir projeto
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Excluir identidade visual?">
        <p className="mb-6 text-sm text-ink/70">
          Isto apaga <strong className="font-normal text-wine">{name}</strong> com todas as etapas, versões, arquivos, comentários e o link. O cliente e os conteúdos de redes sociais não são afetados. Não dá para desfazer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteIdentityProject(projectId);
                if (!r.ok) return toast(r.error ?? 'Erro', 'error');
                toast('Projeto excluído');
                router.push('/admin/identidades');
                router.refresh();
              })
            }
          >
            Excluir definitivamente
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Interruptor para ativar/desativar uma etapa na visão geral. */
export function StageSwitch({ stageId, enabled, label }: { stageId: string; enabled: boolean; label: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${label}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setStageEnabled(stageId, !enabled);
          if (!r.ok) return toast(r.error ?? 'Erro', 'error');
          router.refresh();
        })
      }
      className={cn('relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-60', enabled ? 'border-wine bg-wine' : 'border-wine/30 bg-white')}
    >
      <span className={cn('absolute top-0.5 size-4 rounded-full transition-all', enabled ? 'left-[1.4rem] bg-white' : 'left-0.5 bg-wine/40')} />
    </button>
  );
}
