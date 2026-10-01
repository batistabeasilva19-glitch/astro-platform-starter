'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose muda a cada render do pai; guardar em ref evita reexecutar o efeito
  // (que devolvia o foco ao diálogo e tirava o cursor do campo a cada letra digitada).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // foca o diálogo só se nenhum campo interno já recebeu foco (ex.: autoFocus)
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cn(
          'animate-pop relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 outline-none sm:max-w-md sm:rounded-[2rem] sm:p-8',
          className,
        )}
      >
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 rounded-full p-2 text-ink/50 transition hover:bg-blush hover:text-wine">
          <X className="size-5" />
        </button>
        {title && <h2 className="h-display mb-4 pr-8 text-2xl text-wine">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
