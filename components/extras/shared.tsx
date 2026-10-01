'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export function useAct() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      if (msg) toast(msg);
      after?.();
      router.refresh();
    });
  return { act, pending, toast };
}

/** Número da ordem + setas para subir/descer. */
export function OrderControls({ n, first, last, onUp, onDown, disabled }: { n: number; first: boolean; last: boolean; onUp: () => void; onDown: () => void; disabled?: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button aria-label="Subir" disabled={first || disabled} onClick={onUp} className="rounded-full p-1 text-wine hover:bg-blush disabled:opacity-25"><ArrowUp className="size-3.5" /></button>
      <span className="h-display flex size-8 items-center justify-center rounded-full bg-wine text-sm text-white">{n}</span>
      <button aria-label="Descer" disabled={last || disabled} onClick={onDown} className="rounded-full p-1 text-wine hover:bg-blush disabled:opacity-25"><ArrowDown className="size-3.5" /></button>
    </div>
  );
}

export const Chip = ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={cn('rounded-full px-3 py-1 text-xs', className)}>{children}</span>;
