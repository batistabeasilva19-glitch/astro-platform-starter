'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Sparkle } from '@/components/brand/Brand';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastCtx = createContext<(message: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-6 py-3 text-sm',
              t.tone === 'success' ? 'bg-wine text-white' : 'border border-wine bg-white text-wine',
            )}
          >
            {t.tone === 'success' && <Sparkle className="size-3.5 shrink-0 text-blush" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
