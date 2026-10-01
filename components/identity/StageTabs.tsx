'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Abas das etapas. Como trocar de etapa só muda o `?etapa=` (a página fica a mesma),
 * o Next mantém a tela antiga até a nova carregar — parecia que o clique "não fazia nada".
 * Aqui a aba clicada fica ativa na hora e mostra um indicador de carregamento.
 */
export function StageTabs({ tabs, current }: { tabs: { key: string; label: string; href: string; muted: boolean }[]; current: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const params = useSearchParams();
  useEffect(() => setPending(null), [params]);
  const active = pending ?? current;
  return (
    <nav className="no-scrollbar mb-8 flex gap-1.5 overflow-x-auto pb-1" aria-label="Etapas" aria-busy={!!pending}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          onClick={() => t.key !== current && setPending(t.key)}
          aria-current={active === t.key ? 'page' : undefined}
          className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[0.8rem] transition', active === t.key ? 'border-wine bg-wine text-white' : 'border-wine/25 text-wine hover:bg-blush', t.muted && active !== t.key && 'opacity-45')}
        >
          {pending === t.key && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
