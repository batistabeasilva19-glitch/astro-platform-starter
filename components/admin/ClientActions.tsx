'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Trash2 } from 'lucide-react';
import { deleteClient } from '@/lib/actions/clients';
import { sendAllDrafts } from '@/lib/actions/content';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export function SendAllButton({ clientId, drafts, awaiting = 0, changes = 0 }: { clientId: string; drafts: number; awaiting?: number; changes?: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          if (drafts) return setOpen(true);
          const parts = [awaiting ? `${awaiting} já ${awaiting === 1 ? 'está aguardando' : 'estão aguardando'} aprovação do cliente` : '', changes ? `${changes} ${changes === 1 ? 'tem alteração solicitada (suba uma nova versão e envie pelo próprio conteúdo)' : 'têm alteração solicitada (suba uma nova versão e envie pelo próprio conteúdo)'}` : ''].filter(Boolean);
          toast(`Não há rascunhos para enviar${parts.length ? `: ${parts.join('; ')}` : ''}. Crie um conteúdo novo ou volte um conteúdo para “Rascunho”.`, 'error');
        }}
        className={drafts ? '' : 'opacity-70'}
      >
        <Send className="size-4" /> Enviar para aprovação{drafts ? ` (${drafts})` : ''}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Enviar para aprovação?">
        <p className="mb-6 text-sm text-ink/70">
          {drafts} {drafts === 1 ? 'rascunho será enviado' : 'rascunhos serão enviados'} e ficará{drafts === 1 ? '' : 'ão'} visível{drafts === 1 ? '' : 'is'} no link do cliente. Conteúdos sem arte são ignorados.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await sendAllDrafts(clientId);
                setOpen(false);
                if (!r.ok) return toast(r.error, 'error');
                toast(`${r.sent} enviado${r.sent === 1 ? '' : 's'} para aprovação ♡`);
                if (r.skipped.length) toast(r.skipped[0], 'error');
                router.refresh();
              })
            }
          >
            Enviar agora
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> Excluir cliente
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Excluir cliente?">
        <p className="mb-6 text-sm text-ink/70">
          Isto apaga <strong className="font-normal text-wine">{name}</strong> com todos os conteúdos, versões, comentários, arquivos e o link de aprovação. Não dá para desfazer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteClient(clientId);
                if (!r.ok) return toast(r.error, 'error');
                toast('Cliente excluído');
                router.push('/admin/clients');
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
