'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteContent } from '@/lib/actions/content';
import { useToast } from '@/components/ui/Toast';

/** Excluir uma postagem direto da lista, sem precisar abri-la (útil quando a página dela não abre). */
export function RowDelete({ id, title, className }: { id: string; title: string; className?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={`Excluir ${title}`}
      title="Excluir"
      disabled={pending}
      onClick={() =>
        confirm(`Excluir “${title}” e todas as artes dela? Não dá para desfazer.`) &&
        start(async () => {
          const r = await deleteContent(id);
          if (!r.ok) return toast(r.error, 'error');
          toast('Postagem excluída');
          router.refresh();
        })
      }
      className={className ?? 'absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-wine shadow-sm ring-1 ring-wine/20 transition hover:bg-wine hover:text-white'}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
