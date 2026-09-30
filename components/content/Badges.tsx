import { FORMAT_META, STATUS_META } from '@/lib/constants';
import type { ContentFormat, ContentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export function FormatIcon({ format, className }: { format: ContentFormat; className?: string }) {
  const Icon = FORMAT_META[format].icon;
  return <Icon className={cn('size-4', className)} aria-hidden />;
}

export function FormatTag({ format, className }: { format: ContentFormat; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink/70', className)}>
      <FormatIcon format={format} className="size-3.5 text-wine" />
      {FORMAT_META[format].label}
    </span>
  );
}

export function StatusBadge({
  status,
  audience = 'admin',
  className,
}: {
  status: ContentStatus;
  audience?: 'admin' | 'client';
  className?: string;
}) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] leading-tight', m.chip, className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', m.dot)} />
      {audience === 'client' ? m.client : m.label}
    </span>
  );
}
