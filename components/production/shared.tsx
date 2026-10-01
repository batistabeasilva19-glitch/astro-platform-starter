'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { CATEGORY_BY_ID, DUE_CHIP, PRIORITY_BY_ID, dueState, initialsOf, type MemberRow, type Priority, type TagRow } from '@/lib/production/types';

/** Executa uma ação do servidor, mostra erro/sucesso e atualiza a tela. */
export function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Não foi possível concluir.', 'error');
      if (msg) toast(msg);
      after?.();
      router.refresh();
    });
  return { run, pending, toast, router };
}

export function PriorityDot({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const p = PRIORITY_BY_ID[priority];
  return (
    <span className="inline-flex items-center gap-1.5" title={`Prioridade ${p.label.toLowerCase()}`}>
      <span className={cn('size-2.5 rounded-full', p.dot)} />
      {withLabel && <span className="text-xs text-ink/70">{p.label}</span>}
    </span>
  );
}

export function CategoryBadge({ id, className }: { id: string; className?: string }) {
  const c = CATEGORY_BY_ID[id] ?? CATEGORY_BY_ID.other;
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-wine/70', className)}>
      <Icon className="size-3" aria-hidden />
      {c.label}
    </span>
  );
}

const fmtShort = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export function DueChip({ due, time, done }: { due: string | null; time?: string | null; done: boolean }) {
  if (!due) return null;
  const { state, label } = dueState(due, done);
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem]', state ? DUE_CHIP[state] : 'bg-ink/5 text-ink/65')}>
      <CalendarClock className="size-3" aria-hidden />
      {fmtShort(due)}
      {time ? ` ${time.slice(0, 5)}` : ''}
      {label && <span className="font-normal">· {label}</span>}
    </span>
  );
}

export function MemberAvatar({ member, className }: { member: MemberRow; className?: string }) {
  return (
    <span title={member.name} className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.62rem] text-white ring-2 ring-white', className)} style={{ background: member.color }}>
      {initialsOf(member.name)}
    </span>
  );
}

export function TagPill({ tag, className }: { tag: TagRow; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] text-white', className)} style={{ background: tag.color }}>
      {tag.name}
    </span>
  );
}
