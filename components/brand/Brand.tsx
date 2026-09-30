import { cn } from '@/lib/utils';

/** Logotipo Soltria (extraído do PDF). `tone="light"` = branco (para fundos vinho/grafite). */
export function Logo({
  tone = 'wine',
  className,
  withTagline = false,
}: {
  tone?: 'wine' | 'light';
  className?: string;
  withTagline?: boolean;
}) {
  const base = withTagline ? 'logo' : 'wordmark';
  const src = `/brand/${base}${tone === 'wine' ? '-wine' : ''}.png`;
  return <img src={src} alt="Soltria — Beatriz Batista, Publicitária" className={cn('h-auto select-none', className)} draggable={false} />;
}

/** Estrela de 4 pontas (elemento complementar da marca). */
export function Sparkle({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="-10 -10 20 20" aria-hidden className={cn('inline-block fill-current', animate && 'animate-twinkle', className)}>
      <path d="M0,-10 C0.9,-0.9 0.9,-0.9 10,0 C0.9,0.9 0.9,0.9 0,10 C-0.9,0.9 -0.9,0.9 -10,0 C-0.9,-0.9 -0.9,-0.9 0,-10 Z" />
    </svg>
  );
}

type ElementName = 'brush-stroke' | 'paintbrush' | 'sparkles' | 'rays';

/** Elementos gráficos originais do PDF (pincelada, pincel, brilhos). */
export function BrandElement({
  name,
  tone = 'light',
  className,
}: {
  name: ElementName;
  tone?: 'wine' | 'light';
  className?: string;
}) {
  return (
    <img
      src={`/brand/${name}${tone === 'wine' ? '-wine' : ''}.png`}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('pointer-events-none h-auto select-none', className)}
    />
  );
}
