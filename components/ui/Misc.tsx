import { Sparkle } from '@/components/brand/Brand';
import { cn, initials } from '@/lib/utils';

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return src ? (
    <img src={src} alt={name} className={cn('rounded-full bg-blush object-cover', className)} />
  ) : (
    <span className={cn('inline-flex items-center justify-center rounded-full bg-wine font-display text-white', className)} aria-label={name}>
      {initials(name)}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
      <Sparkle className="size-6 text-wine/60" animate />
      <p className="h-display text-2xl text-wine">{title}</p>
      {children && <div className="max-w-md text-sm text-ink/60">{children}</div>}
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label mb-2 text-wine/70">{eyebrow}</p>}
        <h1 className="h-display text-4xl text-wine sm:text-5xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
