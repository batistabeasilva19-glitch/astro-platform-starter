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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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
