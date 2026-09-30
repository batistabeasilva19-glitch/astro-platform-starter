import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'outline' | 'soft' | 'ghost' | 'dark' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full border font-normal tracking-wide whitespace-nowrap select-none',
    'transition-all duration-200 ease-[var(--ease-soft)] active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine',
    size === 'sm' && 'px-4 py-1.5 text-[0.78rem]',
    size === 'md' && 'px-6 py-2.5 text-[0.85rem]',
    size === 'lg' && 'px-8 py-3.5 text-[0.92rem] uppercase tracking-[0.14em]',
    variant === 'primary' && 'border-wine bg-wine text-white hover:bg-wine-dark hover:border-wine-dark',
    variant === 'dark' && 'border-ink bg-ink text-white hover:bg-black',
    variant === 'outline' && 'border-wine bg-transparent text-wine hover:bg-wine hover:text-white',
    variant === 'soft' && 'border-transparent bg-blush text-wine hover:bg-[#ffd6d3]',
    variant === 'ghost' && 'border-transparent bg-transparent text-ink/70 hover:bg-wine/5 hover:text-wine',
    variant === 'danger' && 'border-wine/30 bg-white text-wine hover:bg-wine hover:text-white',
    extra,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size } & Omit<React.ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
