'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Misc';
import { cn } from '@/lib/utils';
import { Placeholder } from './Carousel';
import { LightImage } from './LightImage';

/** Telas sequenciais de Story: toque/clique nas laterais para avançar ou voltar. */
export function StoryViewer({
  images,
  handle,
  displayName,
  avatarUrl,
}: {
  images: { id: string; url: string }[];
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [i, setI] = useState(0);
  if (!images.length) return <Placeholder aspect="story" text="Nenhuma tela enviada ainda" />;
  const go = (d: number) => setI((c) => Math.min(images.length - 1, Math.max(0, c + d)));

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] bg-ink">
      <LightImage key={images[i].id} src={images[i].url} alt={`Tela ${i + 1}`} className="size-full object-cover" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-ink/50 to-transparent p-3">
        <div className="flex gap-1">
          {images.map((img, n) => (
            <span key={img.id} className={cn('h-0.5 flex-1 rounded-full', n <= i ? 'bg-white' : 'bg-white/40')} />
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-white">
          <Avatar name={displayName} src={avatarUrl} className="size-7 text-[0.6rem]" />
          <span className="text-xs">@{handle}</span>
        </div>
      </div>
      <button aria-label="Tela anterior" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" />
      <button aria-label="Próxima tela" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-2/3" />
      <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-[0.7rem] text-white">
        {i + 1}/{images.length}
      </span>
    </div>
  );
}
