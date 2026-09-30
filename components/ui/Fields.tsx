import { cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="label mb-2 block text-wine">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn('field', p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cn('field min-h-24 resize-y leading-relaxed', p.className)} />
);
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cn('field appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%277%27 fill=%27none%27 stroke=%27%23771430%27 stroke-width=%271.6%27%3E%3Cpath d=%27m1 1 5 5 5-5%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_1.1rem_center] bg-no-repeat pr-10', p.className)} />
);

export function FormMessage({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-2xl border border-wine/30 bg-blush px-4 py-3 text-sm text-wine">
      {error}
    </p>
  );
}
