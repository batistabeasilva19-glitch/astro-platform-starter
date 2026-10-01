'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { addDays, dayMonth, todayBR } from '@/lib/perf/calc';
import { cn } from '@/lib/utils';
import { CATEGORY_BY_ID, DONE_KINDS, PRIORITY_BY_ID, dueState, type ColumnRow, type TaskLite } from '@/lib/production/types';
import { type CardCtx } from './TaskCard';
import { CategoryBadge, DueChip, MemberAvatar, PriorityDot } from './shared';

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const isDone = (t: TaskLite, ctx: CardCtx) => DONE_KINDS.includes(ctx.columnKind.get(t.column_id) ?? 'custom');
const groupByDay = (tasks: TaskLite[]) => {
  const m = new Map<string, TaskLite[]>();
  for (const t of tasks) if (t.due_date) m.set(t.due_date, [...(m.get(t.due_date) ?? []), t]);
  return m;
};

function MiniTask({ t, ctx, onOpen }: { t: TaskLite; ctx: CardCtx; onOpen: (id: string) => void }) {
  const done = isDone(t, ctx);
  const { state } = dueState(t.due_date, done);
  return (
    <button type="button" onClick={() => onOpen(t.id)} className={cn('flex w-full items-center gap-1.5 truncate rounded-lg px-1.5 py-1 text-left text-[0.7rem] transition hover:bg-blush', state === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-blush-soft text-ink/80', done && 'line-through opacity-60')} title={t.title}>
      <span className={cn('size-1.5 shrink-0 rounded-full', PRIORITY_BY_ID[t.priority].dot)} />
      <span className="truncate">{t.title}</span>
    </button>
  );
}

/** Calendário da produção (mensal): cada tarefa no dia do prazo. Clique abre o card. */
export function CalendarView({ tasks, ctx, onOpen }: { tasks: TaskLite[]; ctx: CardCtx; onOpen: (id: string) => void }) {
  const today = todayBR();
  const [cursor, setCursor] = useState(() => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1));
  const byDay = useMemo(() => groupByDay(tasks), [tasks]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: dim }, (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor);
  const noDate = tasks.filter((t) => !t.due_date);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="h-display text-3xl text-wine first-letter:uppercase">{title}</h2>
        <div className="flex items-center gap-1">
          <button aria-label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-full border border-wine/25 p-2 text-wine hover:bg-wine hover:text-white"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setCursor(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1))} className="rounded-full px-3 py-2 text-xs text-wine hover:bg-blush">Hoje</button>
          <button aria-label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-full border border-wine/25 p-2 text-wine hover:bg-wine hover:text-white"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-wine/15 bg-white">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-7 border-b border-wine/15 bg-blush/60">{WEEK.map((w) => <div key={w} className="label px-2 py-2 text-center text-wine/70">{w}</div>)}</div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const list = d ? (byDay.get(d) ?? []) : [];
              return (
                <div key={i} className={cn('min-h-24 border-b border-r border-wine/10 p-1.5', !d && 'bg-blush-soft/50', d === today && 'bg-blush/40')}>
                  {d && <p className={cn('mb-1 text-xs', d === today ? 'text-wine' : 'text-ink/45')}>{Number(d.slice(8))}</p>}
                  <div className="space-y-1">
                    {list.slice(0, 4).map((t) => <MiniTask key={t.id} t={t} ctx={ctx} onOpen={onOpen} />)}
                    {list.length > 4 && <p className="px-1 text-[0.65rem] text-ink/45">+{list.length - 4} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {noDate.length > 0 && <p className="mt-4 text-xs text-ink/55">{noDate.length} {noDate.length === 1 ? 'tarefa sem prazo' : 'tarefas sem prazo'} (não aparecem no calendário) — veja na lista.</p>}
    </div>
  );
}

/** "Minha semana": segunda a sexta (e fim de semana se houver tarefa) com as entregas de cada dia. */
export function WeekView({ tasks, ctx, onOpen }: { tasks: TaskLite[]; ctx: CardCtx; onOpen: (id: string) => void }) {
  const today = todayBR();
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const [start, setStart] = useState(() => addDays(today, -((dow + 6) % 7)));
  const byDay = useMemo(() => groupByDay(tasks), [tasks]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const shown = days.filter((d, i) => i < 5 || (byDay.get(d)?.length ?? 0) > 0);
  const NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="h-display text-3xl text-wine">Minha semana <span className="label align-middle text-ink/40">{dayMonth(days[0])} a {dayMonth(days[6])}</span></h2>
        <div className="flex items-center gap-1">
          <button aria-label="Semana anterior" onClick={() => setStart(addDays(start, -7))} className="rounded-full border border-wine/25 p-2 text-wine hover:bg-wine hover:text-white"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setStart(addDays(today, -((dow + 6) % 7)))} className="rounded-full px-3 py-2 text-xs text-wine hover:bg-blush">Esta semana</button>
          <button aria-label="Próxima semana" onClick={() => setStart(addDays(start, 7))} className="rounded-full border border-wine/25 p-2 text-wine hover:bg-wine hover:text-white"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {shown.map((d) => {
          const i = days.indexOf(d);
          const list = byDay.get(d) ?? [];
          return (
            <div key={d} className={cn('rounded-3xl border bg-white p-3', d === today ? 'border-wine' : 'border-wine/15')}>
              <p className="label mb-0.5 text-wine">{NAMES[i]}</p>
              <p className="mb-3 text-xs text-ink/45">{dayMonth(d)}{d === today ? ' · hoje' : ''}</p>
              <div className="space-y-1.5">
                {list.length === 0 && <p className="text-xs text-ink/35">Sem entregas</p>}
                {list.map((t) => (
                  <button key={t.id} onClick={() => onOpen(t.id)} className="w-full rounded-xl bg-blush-soft px-2.5 py-2 text-left transition hover:bg-blush">
                    <CategoryBadge id={t.category} className="!text-[0.6rem]" />
                    <p className={cn('text-[0.8rem] leading-snug', isDone(t, ctx) && 'line-through opacity-60')}>{t.title}</p>
                    {t.client_id && <p className="truncate text-[0.68rem] text-wine/70">{ctx.clients.get(t.client_id)}</p>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SortKey = 'title' | 'client' | 'status' | 'priority' | 'due' | 'category';
type GroupKey = '' | 'client' | 'assignee' | 'category' | 'status' | 'priority' | 'due';

/** Lista/tabela com ordenação por coluna e agrupamento. */
export function ListView({ tasks, ctx, columns, boards, onOpen }: { tasks: TaskLite[]; ctx: CardCtx; columns: ColumnRow[]; boards?: Record<string, string>; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'due', dir: 1 });
  const [group, setGroup] = useState<GroupKey>('');
  const colName = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns]);
  const today = todayBR();
  const val = (t: TaskLite, k: SortKey): string | number => {
    switch (k) {
      case 'title': return t.title.toLowerCase();
      case 'client': return (t.client_id ? ctx.clients.get(t.client_id) : '')?.toLowerCase() ?? '';
      case 'status': return colName.get(t.column_id) ?? '';
      case 'priority': return PRIORITY_BY_ID[t.priority].weight;
      case 'due': return t.due_date ?? '9999-12-31';
      case 'category': return CATEGORY_BY_ID[t.category]?.label ?? '';
    }
  };
  const sorted = useMemo(() => [...tasks].sort((a, b) => (val(a, sort.key) < val(b, sort.key) ? -1 : val(a, sort.key) > val(b, sort.key) ? 1 : 0) * sort.dir), [tasks, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupLabel = (t: TaskLite): string[] => {
    switch (group) {
      case 'client': return [t.client_id ? (ctx.clients.get(t.client_id) ?? 'Sem cliente') : 'Sem cliente'];
      case 'assignee': return t.assignee_ids.length ? t.assignee_ids.map((id) => ctx.members.get(id)?.name ?? '—') : ['Sem responsável'];
      case 'category': return [CATEGORY_BY_ID[t.category]?.label ?? 'Outro'];
      case 'status': return [colName.get(t.column_id) ?? '—'];
      case 'priority': return [PRIORITY_BY_ID[t.priority].label];
      case 'due': return [!t.due_date ? 'Sem prazo' : t.due_date < today ? 'Atrasadas' : t.due_date === today ? 'Hoje' : t.due_date <= addDays(today, 7) ? 'Próximos 7 dias' : 'Mais adiante'];
      default: return [''];
    }
  };
  const groups = useMemo(() => {
    const m = new Map<string, TaskLite[]>();
    for (const t of sorted) for (const g of groupLabel(t)) m.set(g, [...(m.get(g) ?? []), t]);
    return [...m.entries()];
  }, [sorted, group]); // eslint-disable-line react-hooks/exhaustive-deps
  const th = (label: string, key: SortKey) => (
    <th className="whitespace-nowrap px-3 py-2.5 text-left font-normal">
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} className="label inline-flex items-center gap-1 text-wine hover:underline">
        {label}{sort.key === key && <ChevronDown className={cn('size-3 transition', sort.dir === -1 && 'rotate-180')} />}
      </button>
    </th>
  );
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <label className="label text-wine/70" htmlFor="grp">Agrupar por</label>
        <select id="grp" value={group} onChange={(e) => setGroup(e.target.value as GroupKey)} className="rounded-full border border-wine/25 bg-white px-3 py-1.5 text-sm">
          <option value="">Sem agrupamento</option><option value="client">Cliente</option><option value="assignee">Responsável</option><option value="category">Categoria</option><option value="status">Status</option><option value="priority">Prioridade</option><option value="due">Prazo</option>
        </select>
        <span className="ml-auto text-xs text-ink/45">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-wine/15 bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <thead><tr className="border-b border-wine/15">{th('Tarefa', 'title')}{th('Cliente', 'client')}<th className="label px-3 py-2.5 text-left font-normal text-wine">Responsável</th>{th('Status', 'status')}{th('Prioridade', 'priority')}{th('Prazo', 'due')}{th('Categoria', 'category')}</tr></thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink/50">Nenhuma tarefa encontrada.</td></tr>}
            {groups.map(([g, list]) => (
              <GroupRows key={g} label={g} count={list.length} showHeader={group !== ''}>
                {list.map((t) => (
                  <tr key={`${g}-${t.id}`} onClick={() => onOpen(t.id)} className="cursor-pointer border-b border-wine/8 transition last:border-0 hover:bg-blush-soft">
                    <td className="max-w-[18rem] px-3 py-2.5"><span className={cn('block truncate', isDone(t, ctx) && 'line-through opacity-55')}>{t.title}</span>{boards?.[t.board_id] && <span className="text-[0.68rem] text-ink/40">{boards[t.board_id]}</span>}</td>
                    <td className="px-3 py-2.5 text-ink/70">{t.client_id ? ctx.clients.get(t.client_id) : '—'}</td>
                    <td className="px-3 py-2.5"><span className="flex -space-x-1.5">{t.assignee_ids.length ? t.assignee_ids.map((id) => ctx.members.get(id)).filter(Boolean).map((m) => <MemberAvatar key={m!.id} member={m!} />) : <span className="text-ink/35">—</span>}</span></td>
                    <td className="px-3 py-2.5 text-ink/70">{colName.get(t.column_id)}</td>
                    <td className="px-3 py-2.5"><PriorityDot priority={t.priority} withLabel /></td>
                    <td className="px-3 py-2.5">{t.due_date ? <DueChip due={t.due_date} time={t.due_time} done={isDone(t, ctx)} /> : <span className="text-ink/35">—</span>}</td>
                    <td className="px-3 py-2.5"><CategoryBadge id={t.category} /></td>
                  </tr>
                ))}
              </GroupRows>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function GroupRows({ label, count, showHeader, children }: { label: string; count: number; showHeader: boolean; children: React.ReactNode }) {
  return (
    <>
      {showHeader && <tr className="bg-blush/50"><td colSpan={7} className="label px-3 py-2 text-wine">{label} <span className="text-ink/40">{count}</span></td></tr>}
      {children}
    </>
  );
}
