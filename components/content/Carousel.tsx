'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LightImage } from './LightImage';

interface Props {
  images: { id: string; url: string }[];
  aspect?: 'portrait' | 'story';
  onIndexChange?: (index: number) => void;
  /** controle externo (ex.: clicar em "Slide 3" nos comentários). */
  index?: number;
}

/** Carrossel estilo feed: setas, bolinhas, contador e gesto de arrastar (scroll-snap). */
export function Carousel({ images, aspect = 'portrait', onIndexChange, index }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (index !== undefined && index !== active) goTo(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) {
      setActive(i);
      onIndexChange?.(i);
    }
  };

  if (!images.length) return <Placeholder aspect={aspect} text="Nenhuma arte enviada ainda" />;

  return (
    <div className="group relative bg-blush">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((img, i) => (
          <div key={img.id} className={cn('w-full shrink-0 snap-center', aspect === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]')}>
            {/* só o slide atual e os vizinhos são carregados/decodificados: artes grandes não estouram a memória */}
            {Math.abs(i - active) <= 1 ? <LightImage src={img.url} alt={`Slide ${i + 1}`} className="size-full object-cover" /> : null}
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[0.7rem] text-white">
            {active + 1}/{images.length}
          </span>
          {active > 0 && (
            <button
              aria-label="Slide anterior"
              onClick={() => goTo(active - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-wine transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          {active < images.length - 1 && (
            <button
              aria-label="Próximo slide"
              onClick={() => goTo(active + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-wine transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((img, i) => (
              <span key={img.id} className={cn('size-1.5 rounded-full transition-all', i === active ? 'w-4 bg-wine' : 'bg-white/80')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Placeholder({ aspect = 'portrait', text }: { aspect?: 'portrait' | 'story' | 'square'; text: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-blush p-6 text-center text-sm text-wine/60',
        aspect === 'story' ? 'aspect-[9/16]' : aspect === 'square' ? 'aspect-square' : 'aspect-[4/5]',
      )}
    >
      {text}
    </div>
  );
}

/** Vídeo com capa (poster). Sem arquivo de vídeo, mostra a capa com selo de play. */
export function VideoPlayer({ src, poster, aspect = 'story' }: { src?: string; poster?: string; aspect?: 'portrait' | 'story' }) {
  const ratio = aspect === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]';
  if (!src) {
    return (
      <div className={cn('relative bg-ink', ratio)}>
        {poster ? <img src={poster} alt="Capa" className="size-full object-cover" /> : <Placeholder aspect={aspect} text="Vídeo ainda não enviado" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/90 p-4 text-wine">
            <Play className="size-6 fill-current" />
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-3 text-center text-[0.7rem] text-white/90">Vídeo ainda não enviado</span>
      </div>
    );
  }
  return (
    <div className={cn('bg-ink', ratio)}>
      <video src={src} poster={poster} controls playsInline preload="metadata" className="size-full object-contain" />
    </div>
  );
}
