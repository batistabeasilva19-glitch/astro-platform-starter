'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { FAV_LABEL, FAV_STAGE, type FavoriteItem } from '@/lib/identity/favorites';
import type { FavKind, SignedAsset } from '@/lib/identity/types';
import { FavButton, useFavorites, type ViewCtx } from './view-context';
import { useLoadedFonts } from './views/TypographyView';

const ORDER: FavKind[] = ['logo', 'palette', 'color', 'font', 'application'];

/** FAVORITOS DO CLIENTE — logos, paletas, cores, tipografias e aplicações. Favoritar não é aprovar. */
export function FavoritesBoard({ items, ctx, fontAssets, hrefBase }: { items: Record<FavKind, FavoriteItem[]>; ctx: ViewCtx; fontAssets: SignedAsset[]; hrefBase?: string }) {
  const fav = useFavorites(ctx);
  const fonts = items.font.flatMap((i) => (i.kind === 'font' ? [i.font] : []));
  const family = useLoadedFonts(fonts, fontAssets);
  const total = ORDER.reduce((n, k) => n + items[k].length, 0);

  if (!total) {
    return (
      <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
        <Heart className="size-6 text-wine/50" />
        <p className="h-display text-2xl text-wine">Nenhum favorito ainda</p>
        <p className="max-w-md text-sm text-ink/60">Toque no ♡ em logos, paletas, cores, fontes e aplicações para guardar aqui o que você mais gostou. Favoritar não aprova nada.</p>
      </div>
    );
  }

  const link = (k: FavKind) => (hrefBase ? `${hrefBase}/${FAV_STAGE[k]}` : undefined);
  const remove = (i: FavoriteItem) => fav.enabled && <FavButton on onClick={() => fav.toggle(i.kind, i.refId)} busy={fav.busy} size="sm" onLabel="Remover" />;

  return (
    <div className="space-y-12">
      {ORDER.filter((k) => items[k].length).map((k) => (
        <section key={k}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="h-display text-3xl text-wine">{FAV_LABEL[k]} <span className="label align-middle text-ink/40">{items[k].length}</span></h2>
            {link(k) && <Link href={link(k)!} className="text-sm text-wine underline-offset-4 hover:underline">Ver etapa</Link>}
          </div>
          <div className={k === 'color' ? 'grid grid-cols-2 gap-3 sm:grid-cols-4' : 'grid gap-4 sm:grid-cols-2'}>
            {items[k].map((i) => (
              <div key={`${i.kind}-${i.refId}`} className="card overflow-hidden">
                {i.kind === 'logo' && (
                  <div className="flex h-40 items-center justify-center bg-white p-6">{i.imageUrl ? <img loading="lazy" decoding="async" src={i.imageUrl} alt={i.label} className="max-h-full max-w-full object-contain" /> : null}</div>
                )}
                {i.kind === 'palette' && (
                  <div className="flex h-24">
                    {i.palette.colors.map((c) => (
                      <span key={c.id} className="flex-1" style={{ backgroundColor: c.hex }} />
                    ))}
                  </div>
                )}
                {i.kind === 'color' && <div className="h-24" style={{ backgroundColor: i.color.hex }} />}
                {i.kind === 'font' && (
                  <p className="px-5 pt-5 text-5xl text-wine" style={{ fontFamily: family(i.font) }}>Aa</p>
                )}
                {i.kind === 'application' && i.imageUrl && <img loading="lazy" decoding="async" src={i.imageUrl} alt={i.label} className="aspect-[4/3] w-full object-cover" />}
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="min-w-0 truncate text-sm" style={i.kind === 'font' ? { fontFamily: family(i.font) } : undefined}>{i.label}</p>
                  {remove(i)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
