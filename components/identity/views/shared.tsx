'use client';

import { Sparkle } from '@/components/brand/Brand';
import { cn } from '@/lib/utils';

export const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={cn('label mb-3 text-wine/70', className)}>{children}</p>;

export function Empty({ text }: { text: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
      <Sparkle className="size-5 text-wine/50" animate />
      <p className="text-sm text-ink/60">{text}</p>
    </div>
  );
}

export const isImage = (a: { mime_type: string | null; file_name: string; storage_path: string }) =>
  (a.mime_type ?? '').startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(a.file_name || a.storage_path);
