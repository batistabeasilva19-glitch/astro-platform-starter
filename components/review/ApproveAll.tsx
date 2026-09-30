'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { approveAll } from '@/lib/actions/portal';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export function ApproveAll({ token, count }: { token: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (count === 0) return null;
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <CheckCheck className="size-4" /> Aprovar todos
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Aprovar todos?">
        <p className="mb-6 text-[0.95rem]">Você está prestes a aprovar <strong className="font-normal text-wine">{count} {count === 1 ? 'conteúdo' : 'conteúdos'}</strong>. Deseja continuar?</p>
        <p className="mb-6 text-xs text-ink/55">Dica: se quiser revisar algum com calma, feche esta janela e abra o conteúdo antes.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>Voltar</Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await approveAll(token);
                setOpen(false);
                if (!r.ok) return toast(r.error, 'error');
                toast(`${r.count} ${r.count === 1 ? 'conteúdo aprovado' : 'conteúdos aprovados'} ♡`);
                router.refresh();
              })
            }
          >
            Sim, aprovar {count}
          </Button>
        </div>
      </Modal>
    </>
  );
}
