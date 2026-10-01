'use client';

import { CheckSquare, Link2, MessageSquare, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DONE_KINDS, type ClientLite, type ColumnKind, type MemberRow, type TagRow, type TaskLite } from '@/lib/production/types';
import { CategoryBadge, DueChip, MemberAvatar, PriorityDot, TagPill } from './shared';

export interface CardCtx {
  clients: Map<string, string>;
  members: Map<string, MemberRow>;
  tags: Map<string, TagRow>;
  columnKind: Map<string, ColumnKind>;
}
export const buildCardCtx = (clients: ClientLite[], members: MemberRow[], tags: TagRow[], columns: { id: string; kind: ColumnKind }[]): CardCtx => ({
  clients: new Map(clients.map((c) => [c.id, c.name])),
  members: new Map(members.map((m) => [m.id, m])),
  tags: new Map(tags.map((t) => [t.id, t])),
  columnKind: new Map(columns.map((c) => [c.id, c.kind])),
});

/**
 * Card compacto (Kanban): categoria, título, cliente, prazo, prioridade, checklist e responsável.
 * Só o essencial — o resto aparece ao abrir o card.
 */
export function TaskCard({ task, ctx, onOpen, dragging, className }: { task: TaskLite; ctx: CardCtx; onOpen?: () => void; dragging?: boolean; className?: string }) {
  const done = DONE_KINDS.includes(ctx.columnKind.get(task.column_id) ?? 'custom');
  const client = task.client_id ? ctx.clients.get(task.client_id) : null;
  const pct = task.checklist.total ? Math.round((task.checklist.done / task.checklist.total) * 100) : 0;
  const tags = task.tag_ids.map((id) => ctx.tags.get(id)).filter(Boolean) as TagRow[];
  const members = task.assignee_ids.map((id) => ctx.members.get(id)).filter(Boolean) as MemberRow[];
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen?.())}
      className={cn('group cursor-grab touch-manipulation rounded-2xl border border-wine/15 bg-white p-3 text-left shadow-[0_1px_0_rgba(119,20,48,0.04)] transition hover:border-wine/40 hover:shadow-sm active:cursor-grabbing', done && 'opacity-70', dragging && 'rotate-1 border-wine shadow-lg', className)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <CategoryBadge id={task.category} />
        <PriorityDot priority={task.priority} />
      </div>
      <p className={cn('text-[0.88rem] leading-snug text-ink', done && 'line-through decoration-ink/30')}>{task.title}</p>
      {client && <p className="mt-0.5 truncate text-xs text-wine/70">{client}</p>}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => <TagPill key={t.id} tag={t} />)}
          {tags.length > 3 && <span className="text-[0.65rem] text-ink/45">+{tags.length - 3}</span>}
        </div>
      )}
      {task.checklist.total > 0 && (
        <div className="mt-2.5">
          <div className="h-1 overflow-hidden rounded-full bg-blush"><div className="h-full rounded-full bg-wine transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.68rem] text-ink/55">
        <DueChip due={task.due_date} time={task.due_time} done={done} />
        {task.checklist.total > 0 && <span className="inline-flex items-center gap-1"><CheckSquare className="size-3" />{task.checklist.done}/{task.checklist.total}</span>}
        {task.content_id && <span className="inline-flex items-center gap-1" title="Vinculado a um conteúdo"><Link2 className="size-3" /></span>}
        {task.comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{task.comments}</span>}
        {task.attachments > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="size-3" />{task.attachments}</span>}
        {members.length > 0 && <span className="ml-auto flex -space-x-1.5">{members.slice(0, 3).map((m) => <MemberAvatar key={m.id} member={m} />)}</span>}
      </div>
    </div>
  );
}
