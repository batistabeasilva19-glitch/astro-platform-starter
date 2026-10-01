'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Imagem "leve": baixa o arquivo, reduz para `width` px (no máximo) e desenha num canvas.
 * Artes de design podem ter 5000+ px (centenas de MB descompactadas) e derrubam o navegador com "Out of Memory";
 * aqui só a versão reduzida fica na memória, e as decodificações acontecem UMA POR VEZ (fila).
 * Se algo falhar (CORS, formato), usa a <img> normal.
 */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
};

export function LightImage({ src, alt, width = 1080, className, onVisible }: { src: string; alt: string; width?: number; className?: string; onVisible?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    let dead = false;
    setState('loading');
    enqueue(async () => {
      if (dead) return;
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (dead) return;
      const probe = await createImageBitmap(blob);
      const k = Math.min(1, width / Math.max(probe.width, probe.height));
      const w = Math.max(1, Math.round(probe.width * k));
      const h = Math.max(1, Math.round(probe.height * k));
      let bmp = probe;
      if (k < 1) {
        bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' });
        probe.close();
      }
      const c = ref.current;
      if (!c || dead) {
        bmp.close();
        return;
      }
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d')?.drawImage(bmp, 0, 0);
      bmp.close();
      setState('ready');
      onVisible?.();
    }).catch(() => !dead && setState('fallback'));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, width]);

  if (state === 'fallback') return <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} className={className} />;
  return <canvas ref={ref} role="img" aria-label={alt} className={className} style={state === 'loading' ? { opacity: 0 } : undefined} />;
}
