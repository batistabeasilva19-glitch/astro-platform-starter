'use client';

import { useState } from 'react';
import type { SignedAsset } from '@/lib/identity/types';
import { ImageViewer } from '../ImageViewer';
import { useFeedback, type ViewCtx } from '../view-context';

/** Grade de imagens; ao tocar abre o visualizador com zoom e comentários na imagem. */
export function Photos({ ctx, images }: { ctx: ViewCtx; images: SignedAsset[] }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  const feedback = useFeedback(ctx);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img) => (
          <button key={img.id} onClick={() => setOpen(img)} className="group overflow-hidden rounded-2xl bg-blush">
            <img src={img.url} alt={img.caption || ''} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      <ImageViewer asset={open} onClose={() => setOpen(null)} annotations={ctx.annotations} feedback={feedback} />
    </div>
  );
}
