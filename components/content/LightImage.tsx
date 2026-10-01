'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Imagem "leve": baixa o arquivo, reduz para `width` px (no máximo) e desenha num canvas.
 * Artes de design podem ter 5000+ px (centenas de MB descompactadas) e derrubam o navegador com "Out of Memory";
 * aqui só a versão reduzida fica na memória. Os downloads rodam em paralelo (só do que está perto da tela) e a
 * decodificação, que é a parte pesada de memória, acontece UMA POR VEZ (fila).
 * Se algo falhar (CORS, formato), usa a <img> normal.
 */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
};

/** Lê largura/altura só do cabeçalho (PNG e JPEG) — sem decodificar a imagem inteira. */
async function headerSize(blob: Blob): Promise<{ w: number; h: number } | null> {
  const b = new Uint8Array(await blob.slice(0, 262144).arrayBuffer());
  if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

export function LightImage({ src, alt, width = 1080, className, onVisible }: { src: string; alt: string; width?: number; className?: string; onVisible?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');

  const [near, setNear] = useState(false);

  // só começa quando a imagem está perto de aparecer na tela
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setNear(true), io.disconnect()), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let dead = false;
    setState('loading');
    (async () => {
      const res = await fetch(src); // download em paralelo
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (dead) return;
      await enqueue(async () => {
        if (dead) return;
        const dim = await headerSize(blob);
        let bmp: ImageBitmap;
        if (dim && dim.w > 0 && dim.h > 0) {
          const k = Math.min(1, width / Math.max(dim.w, dim.h));
          bmp = k < 1 ? await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(dim.w * k)), resizeHeight: Math.max(1, Math.round(dim.h * k)), resizeQuality: 'medium' }) : await createImageBitmap(blob);
        } else {
          const probe = await createImageBitmap(blob);
          const k = Math.min(1, width / Math.max(probe.width, probe.height));
          bmp = k < 1 ? await createImageBitmap(probe, { resizeWidth: Math.max(1, Math.round(probe.width * k)), resizeHeight: Math.max(1, Math.round(probe.height * k)), resizeQuality: 'medium' }) : probe;
          if (bmp !== probe) probe.close();
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
      });
    })().catch(() => !dead && setState('fallback'));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, width, near]);

  if (state === 'fallback') return <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} className={className} />;
  return <canvas ref={ref} role="img" aria-label={alt} className={className} style={state === 'loading' ? { opacity: 0 } : undefined} />;
}
