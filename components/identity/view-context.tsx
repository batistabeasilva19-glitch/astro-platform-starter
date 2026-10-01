'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { addAdminAnnotation, deleteAnnotation } from '@/lib/actions/identity';
import { addAssetAnnotation, toggleFavorite } from '@/lib/actions/identity-portal';
import type { FavKind, IdentityAnnotation, IdentityFavorite, IdentitySelection, StageData } from '@/lib/identity/types';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import type { FeedbackActions } from './ImageViewer';

/**
 * Contexto das visualizações: o MESMO componente serve para o cliente (mode "client", com ações reais)
 * e para a pré-visualização da administradora (mode "admin", somente leitura).
 */
export interface ViewCtx {
  mode: 'client' | 'admin';
  token?: string;
  stage: StageData;
  allStages: StageData[];
  favorites: IdentityFavorite[];
  selections: IdentitySelection[];
  annotations: IdentityAnnotation[];
}

export function useFeedback(ctx: ViewCtx): FeedbackActions {
  if (ctx.mode === 'client') return { viewer: 'client', onAdd: (i) => addAssetAnnotation(ctx.token!, i) };
  return { viewer: 'admin', onAdd: (i) => addAdminAnnotation(i), onDelete: (id) => deleteAnnotation(id) };
}

/** Favoritos do cliente (♡). Favoritar NÃO aprova nada. Só funciona no portal. */
export function useFavorites(ctx: ViewCtx) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const has = (kind: FavKind, ref: string) => ctx.favorites.some((f) => f.kind === kind && f.ref_id === ref);
  const enabled = ctx.mode === 'client' && ctx.stage.status !== 'draft';
  const toggle = (kind: FavKind, ref: string, messages?: { on?: string; off?: string }) =>
    start(async () => {
      const r = await toggleFavorite(ctx.token!, kind, ref);
      if (!r.ok) return toast(r.error, 'error');
      toast(r.favorite ? (messages?.on ?? 'Adicionado aos favoritos ♡') : (messages?.off ?? 'Removido dos favoritos'));
      router.refresh();
    });
  return { has, toggle, busy, enabled };
}

export function FavButton({ on, onClick, busy, label = 'Favoritar', onLabel = 'Favorita', size = 'md', className }: { on: boolean; onClick: () => void; busy?: boolean; label?: string; onLabel?: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition active:scale-[0.97] disabled:opacity-60',
        size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-[0.8rem]',
        on ? 'border-wine bg-wine text-white' : 'border-wine/40 bg-white text-wine hover:bg-blush',
        className,
      )}
    >
      <Heart className={cn(size === 'sm' ? 'size-3.5' : 'size-4', on && 'fill-current')} />
      {on ? onLabel : label}
    </button>
  );
}
