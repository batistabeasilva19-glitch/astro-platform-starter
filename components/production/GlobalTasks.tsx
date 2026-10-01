'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '@/components/ui/Fields';
import { cn } from '@/lib/utils';
import { todayBR } from '@/lib/perf/calc';
import { CATEGORIES, DONE_KINDS, EMPTY_FILTERS, PRIORITIES, filterTasks, type ClientLite, type ColumnRow, type MemberRow, type TagRow, type TaskFilters, type TaskLite } from '@/lib/production/types';
import { buildCardCtx, TaskCard } from './TaskCard';
import { ListView, WeekView } from './Views';
import { TaskModal } from './TaskModal';

interface Props {
  ownerId: string;
  mode: 'all' | 'mine' | 'client';
  tasks: TaskLite[];
  columns: ColumnRow[];
  boards: Record<string, string>;
  members: MemberRow[];
  tags: TagRow[];
  clients: ClientLite[];
  myMemberId?: string;
}

/** Visões que atravessam todos os quadros: lista global, "Minhas tarefas" e tarefas de um cliente. */
export function GlobalTasks({ ownerId, mode, tasks, columns, boards, members, tags, clients, myMemberId }: Props) {
  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_FILTERS, hideDone: mode !== 'mine' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<'lista' | 'semana'>('lista');
  const ctx = useMemo(() => buildCardCtx(clients, members, tags, columns), [clients, members, tags, columns]);
  const doneColumnIds = useMemo(() => new Set(columns.filter((c) => DONE_KINDS.includes(c.kind)).map((c) => c.id)), [columns]);
  const columnsByBoard = useMemo(() => {
    const m: Record<string, ColumnRow[]> = {};
    for (const c of columns) (m[c.board_id] ??= []).push(c);
    return m;
  }, [columns]);
  const base = useMemo(() => (mode === 'mine' && myMemberId ? tasks.filter((t) => t.assignee_ids.includes(myMemberId)) : tasks), [tasks, mode, myMemberId]);
  const visible = useMemo(() => filterTasks(base, filters, { clients, tags, doneColumnIds }), [base, filters, clients, tags, doneColumnIds]);
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const today = todayBR();

  const sections = useMemo(() => {
    const open = visible.filter((t) => !doneColumnIds.has(t.column_id));
    return [
      ['Atrasadas', open.filter((t) => t.due_date && t.due_date < today)],
      ['Hoje', open.filter((t) => t.due_date === today)],
      ['Próximas', open.filter((t) => t.due_date && t.due_date > today)],
      ['Sem prazo', open.filter((t) => !t.due_date)],
      ['Concluídas', visible.filter((t) => doneColumnIds.has(t.column_id)).slice(0, 30)],
    ] as [string, TaskLite[]][];
  }, [visible, doneColumnIds, today]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-wine/50" />
          <Input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Buscar tarefas…" className="!py-2.5 !pl-10 text-sm" aria-label="Buscar tarefas" />
        </div>
        {mode !== 'client' && <Select aria-label="Cliente" value={filters.client} onChange={(e) => set('client', e.target.value)} className="!w-auto !py-2 text-sm"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
        <Select aria-label="Quadro" value={filters.board} onChange={(e) => set('board', e.target.value)} className="!w-auto !py-2 text-sm"><option value="">Todos os quadros</option>{Object.entries(boards).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
        <Select aria-label="Categoria" value={filters.category} onChange={(e) => set('category', e.target.value)} className="!w-auto !py-2 text-sm"><option value="">Todas as categorias</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        <Select aria-label="Prioridade" value={filters.priority} onChange={(e) => set('priority', e.target.value)} className="!w-auto !py-2 text-sm"><option value="">Todas as prioridades</option>{PRIORITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
        <Select aria-label="Tag" value={filters.tag} onChange={(e) => set('tag', e.target.value)} className="!w-auto !py-2 text-sm"><option value="">Todas as tags</option>{tags.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        {mode !== 'mine' && <button onClick={() => set('hideDone', !filters.hideDone)} className="rounded-full border border-wine/25 bg-white px-3.5 py-2 text-xs text-wine hover:bg-blush">{filters.hideDone ? 'Mostrar concluídos' : 'Ocultar concluídos'}</button>}
        {(['overdue', 'today', 'week', 'unassigned'] as const).map((k) => (
          <button key={k} onClick={() => set('quick', filters.quick === k ? '' : k)} className={cn('rounded-full border px-3.5 py-2 text-xs transition', filters.quick === k ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{{ overdue: 'Atrasadas', today: 'Hoje', week: 'Esta semana', unassigned: 'Sem responsável' }[k]}</button>
        ))}
      </div>

      {mode === 'mine' ? (
        <div>
          <div className="mb-5 flex gap-2">
            {(['lista', 'semana'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn('rounded-full border px-4 py-2 text-[0.8rem] transition', tab === t ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{t === 'lista' ? 'Minhas tarefas' : 'Minha semana'}</button>)}
          </div>
          {tab === 'semana' ? (
            <WeekView tasks={visible} ctx={ctx} onOpen={setOpenId} />
          ) : (
            <div className="space-y-8">
              {sections.map(([title, list]) => (
                <section key={title}>
                  <h2 className="h-display mb-3 text-2xl text-wine">{title} <span className="label align-middle text-ink/40">{list.length}</span></h2>
                  {list.length === 0 ? <p className="text-sm text-ink/40">Nada por aqui.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((t) => <TaskCard key={t.id} task={t} ctx={ctx} onOpen={() => setOpenId(t.id)} className="cursor-pointer" />)}</div>}
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ListView tasks={visible} ctx={ctx} columns={columns} boards={boards} onOpen={setOpenId} />
      )}
      {openId && <TaskModal key={openId} taskId={openId} ownerId={ownerId} columnsByBoard={columnsByBoard} members={members} tags={tags} clients={clients} onClose={() => setOpenId(null)} />}
    </div>
  );
}
