'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Archive, ArchiveRestore, CalendarDays, ChevronLeft, ClipboardList, Eye, EyeOff, GripVertical, List, Plus, Search, Settings2, Star, X } from 'lucide-react';
import { createTask, deleteFilter, moveTask, saveFilter, setBoardFlag } from '@/lib/actions/production';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { CATEGORIES, DONE_KINDS, EMPTY_FILTERS, PRIORITIES, TASK_TEMPLATES, filterTasks, positionBetween, type BoardRow, type ClientLite, type ColumnRow, type MemberRow, type TagRow, type TaskFilters, type TaskLite } from '@/lib/production/types';
import { buildCardCtx, TaskCard } from './TaskCard';
import { CalendarView, ListView, WeekView } from './Views';
import { TaskModal } from './TaskModal';
import { BoardSettingsModal, type RecurrenceRow } from './BoardSettingsModal';

export interface SavedFilter {
  id: string;
  name: string;
  filter: Partial<TaskFilters>;
}
export interface ActivityRow {
  id: string;
  task_id: string | null;
  actor_name: string;
  detail: string;
  created_at: string;
}
type View = 'quadro' | 'calendario' | 'lista' | 'semana' | 'atividades';
const VIEWS: { id: View; label: string; icon: typeof List }[] = [
  { id: 'quadro', label: 'Quadro', icon: ClipboardList },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'lista', label: 'Lista', icon: List },
  { id: 'semana', label: 'Minha semana', icon: CalendarDays },
  { id: 'atividades', label: 'Atividades', icon: ClipboardList },
];

interface Props {
  ownerId: string;
  board: BoardRow;
  columns: ColumnRow[];
  tasks: TaskLite[];
  members: MemberRow[];
  tags: TagRow[];
  clients: ClientLite[];
  recurrences: RecurrenceRow[];
  savedFilters: SavedFilter[];
  activity: ActivityRow[];
  showArchived: boolean;
  initialFilters?: Partial<TaskFilters>;
  initialOpenTask?: string;
}

/** Quadro Kanban de uma board: arrastar cards entre colunas e dentro da coluna, filtros, busca e 5 visões. */
export function BoardView(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>('quadro');
  const [tasks, setTasks] = useState(p.tasks);
  useEffect(() => setTasks(p.tasks), [p.tasks]);
  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_FILTERS, hideDone: !!p.board.settings.hide_done, ...p.initialFilters });
  const [openId, setOpenId] = useState<string | null>(p.initialOpenTask ?? null);
  const [settings, setSettings] = useState(false);
  const [saveName, setSaveName] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addTpl, setAddTpl] = useState('');
  const [active, setActive] = useState<TaskLite | null>(null);
  const [showMore, setShowMore] = useState(false);

  const ctx = useMemo(() => buildCardCtx(p.clients, p.members, p.tags, p.columns), [p.clients, p.members, p.tags, p.columns]);
  const doneColumnIds = useMemo(() => new Set(p.columns.filter((c) => DONE_KINDS.includes(c.kind)).map((c) => c.id)), [p.columns]);
  const visible = useMemo(() => filterTasks(tasks, filters, { clients: p.clients, tags: p.tags, doneColumnIds }), [tasks, filters, p.clients, p.tags, doneColumnIds]);
  const hasFilter = JSON.stringify({ ...filters, hideDone: false }) !== JSON.stringify({ ...EMPTY_FILTERS });
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const columnsByBoard = useMemo(() => ({ [p.board.id]: p.columns }), [p.board.id, p.columns]);

  // ── drag and drop ──────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const group = (list: TaskLite[]) => {
    const m: Record<string, string[]> = Object.fromEntries(p.columns.map((c) => [c.id, [] as string[]]));
    for (const t of [...list].sort((a, b) => a.position - b.position)) (m[t.column_id] ??= []).push(t.id);
    return m;
  };
  const [items, setItems] = useState<Record<string, string[]>>(() => group(visible));
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setItems(group(visible));
  }, [visible, p.columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const containerOf = (id: string) => (id in items ? id : Object.keys(items).find((k) => items[k].includes(id)));

  const onDragStart = (e: DragStartEvent) => {
    dragging.current = true;
    setActive(byId.get(String(e.active.id)) ?? null);
  };
  const onDragOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    if (!over) return;
    const from = containerOf(String(a.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setItems((cur) => {
      const overIdx = cur[to].indexOf(String(over.id));
      const idx = overIdx >= 0 ? overIdx : cur[to].length;
      return { ...cur, [from]: cur[from].filter((x) => x !== a.id), [to]: [...cur[to].slice(0, idx), String(a.id), ...cur[to].slice(idx)] };
    });
  };
  const onDragEnd = async (e: DragEndEvent) => {
    dragging.current = false;
    setActive(null);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    const from = containerOf(id);
    const to = over ? containerOf(over) : from;
    if (!from || !to) return setItems(group(visible));
    let list = items[to];
    if (over && from === to && over !== id) {
      const oi = list.indexOf(over);
      const ai = list.indexOf(id);
      if (oi >= 0 && ai >= 0) {
        list = arrayMove(list, ai, oi);
        setItems((cur) => ({ ...cur, [to]: list }));
      }
    }
    const idx = list.indexOf(id);
    const prev = idx > 0 ? byId.get(list[idx - 1])?.position ?? null : null;
    const next = idx < list.length - 1 ? byId.get(list[idx + 1])?.position ?? null : null;
    const position = positionBetween(prev, next);
    const orig = byId.get(id);
    if (orig && orig.column_id === to && Math.abs(orig.position - position) < 1e-9) return;
    // atualização otimista; se o servidor recusar, a tela volta ao estado salvo
    const doneNow = doneColumnIds.has(to);
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, column_id: to, position, completed_at: doneNow ? (t.completed_at ?? new Date().toISOString()) : null } : t)));
    const r = await moveTask(id, to, position);
    if (!r.ok) {
      toast(r.error, 'error');
      setTasks(p.tasks);
      setItems(group(p.tasks));
    }
    router.refresh();
  };

  const quickAdd = async (columnId: string) => {
    const title = addTitle.trim();
    const tpl = TASK_TEMPLATES.find((t) => t.id === addTpl);
    if (!title && !tpl) return;
    const r = await createTask({ boardId: p.board.id, columnId, title, templateId: addTpl || undefined });
    if (!r.ok) return toast(r.error, 'error');
    setAddTitle('');
    setAddTpl('');
    router.refresh();
    if (tpl) setOpenId(r.id);
  };

  const activeFilterCount = [filters.client, filters.assignee, filters.category, filters.priority, filters.tag, filters.quick].filter(Boolean).length;

  return (
    <div>
      {/* cabeçalho do quadro */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/producao" className="label inline-flex items-center gap-1 text-wine/70 hover:text-wine"><ChevronLeft className="size-3.5" /> Produção</Link>
          <h1 className="h-display mt-1 flex items-center gap-2 text-3xl text-wine sm:text-4xl">{p.board.name}
            <button aria-label={p.board.favorite ? 'Remover dos favoritos' : 'Favoritar quadro'} onClick={async () => { const r = await setBoardFlag(p.board.id, 'favorite', !p.board.favorite); if (!r.ok) toast(r.error, 'error'); router.refresh(); }} className="rounded-full p-1.5 text-wine hover:bg-blush"><Star className={cn('size-5', p.board.favorite && 'fill-current')} /></button>
          </h1>
          {p.board.description && <p className="mt-1 max-w-2xl text-sm text-ink/60">{p.board.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={async () => { const r = await setBoardFlag(p.board.id, 'archived', true); if (!r.ok) return toast(r.error, 'error'); toast('Quadro arquivado'); router.push('/admin/producao'); }}><Archive className="size-3.5" /> Arquivar</Button>
          <Button variant="outline" size="sm" onClick={() => setSettings(true)}><Settings2 className="size-3.5" /> Configurar</Button>
        </div>
      </div>

      {/* visões */}
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[0.8rem] transition', view === id ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}><Icon className="size-3.5" />{label}</button>
        ))}
      </div>

      {/* busca e filtros */}
      {view !== 'atividades' && (
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-wine/50" />
              <Input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Buscar tarefas…" className="!py-2.5 !pl-10 text-sm" aria-label="Buscar tarefas" />
            </div>
            {([['overdue', 'Atrasadas'], ['today', 'Hoje'], ['week', 'Esta semana'], ['unassigned', 'Sem responsável']] as const).map(([k, l]) => (
              <button key={k} onClick={() => set('quick', filters.quick === k ? '' : k)} aria-pressed={filters.quick === k} className={cn('rounded-full border px-3.5 py-2 text-xs transition', filters.quick === k ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{l}</button>
            ))}
            <button onClick={() => set('hideDone', !filters.hideDone)} className="inline-flex items-center gap-1.5 rounded-full border border-wine/25 bg-white px-3.5 py-2 text-xs text-wine hover:bg-blush">{filters.hideDone ? <><Eye className="size-3.5" /> Mostrar concluídos</> : <><EyeOff className="size-3.5" /> Ocultar concluídos</>}</button>
            <button onClick={() => setShowMore((v) => !v)} className={cn('rounded-full border px-3.5 py-2 text-xs transition', showMore || activeFilterCount ? 'border-wine text-wine' : 'border-wine/25 text-wine hover:bg-blush')}>Mais filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
            {(hasFilter || filters.hideDone !== !!p.board.settings.hide_done) && <button onClick={() => setFilters({ ...EMPTY_FILTERS, hideDone: !!p.board.settings.hide_done })} className="inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline"><X className="size-3" /> Limpar</button>}
          </div>
          {showMore && (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Select aria-label="Cliente" value={filters.client} onChange={(e) => set('client', e.target.value)} className="!py-2 text-sm"><option value="">Todos os clientes</option>{p.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Select aria-label="Responsável" value={filters.assignee} onChange={(e) => set('assignee', e.target.value)} className="!py-2 text-sm"><option value="">Todos os responsáveis</option><option value="none">Sem responsável</option>{p.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
              <Select aria-label="Categoria" value={filters.category} onChange={(e) => set('category', e.target.value)} className="!py-2 text-sm"><option value="">Todas as categorias</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
              <Select aria-label="Prioridade" value={filters.priority} onChange={(e) => set('priority', e.target.value)} className="!py-2 text-sm"><option value="">Todas as prioridades</option>{PRIORITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
              <Select aria-label="Tag" value={filters.tag} onChange={(e) => set('tag', e.target.value)} className="!py-2 text-sm"><option value="">Todas as tags</option>{p.tags.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Select aria-label="Status" value={filters.column} onChange={(e) => set('column', e.target.value)} className="!py-2 text-sm"><option value="">Todos os status</option>{p.columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {p.savedFilters.map((f) => (
              <span key={f.id} className="inline-flex items-center overflow-hidden rounded-full border border-wine/25 bg-white">
                <button onClick={() => setFilters({ ...EMPTY_FILTERS, ...f.filter })} className="px-3 py-1.5 text-wine hover:bg-blush"><Star className="mr-1 inline size-3" />{f.name}</button>
                <button aria-label={`Excluir filtro ${f.name}`} onClick={async () => { await deleteFilter(f.id); router.refresh(); }} className="px-2 py-1.5 text-wine/50 hover:bg-blush hover:text-wine"><X className="size-3" /></button>
              </span>
            ))}
            {hasFilter && <button onClick={() => setSaveName('')} className="rounded-full border border-dashed border-wine/40 px-3 py-1.5 text-wine hover:bg-blush"><Star className="mr-1 inline size-3" />Salvar este filtro</button>}
            <Link href={`/admin/producao/${p.board.id}${p.showArchived ? '' : '?arquivadas=1'}`} className="ml-auto inline-flex items-center gap-1 text-wine/70 hover:text-wine">{p.showArchived ? <><ArchiveRestore className="size-3.5" /> Ocultar arquivadas</> : <><Archive className="size-3.5" /> Ver arquivadas</>}</Link>
          </div>
        </div>
      )}

      {view === 'quadro' && (
        <DndContext id={`board-${p.board.id}`} sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { dragging.current = false; setActive(null); setItems(group(visible)); }}>
          <div className="-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-6 sm:mx-0 sm:px-0">
            {p.columns.map((col) => (
              <Column key={col.id} col={col} ids={items[col.id] ?? []} byId={byId} ctx={ctx} onOpen={setOpenId} done={doneColumnIds.has(col.id)}>
                {adding === col.id ? (
                  <div className="space-y-2 rounded-2xl border border-wine/30 bg-white p-2.5">
                    <Input autoFocus value={addTitle} onChange={(e) => setAddTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' ? quickAdd(col.id) : e.key === 'Escape' && setAdding(null)} placeholder="Título da tarefa…" className="!py-2 text-sm" />
                    <Select value={addTpl} onChange={(e) => setAddTpl(e.target.value)} className="!py-1.5 text-xs" aria-label="Modelo"><option value="">Sem modelo</option>{TASK_TEMPLATES.map((t) => <option key={t.id} value={t.id}>Modelo: {t.label}</option>)}</Select>
                    <div className="flex gap-2"><Button size="sm" onClick={() => quickAdd(col.id)} disabled={!addTitle.trim() && !addTpl}>Adicionar</Button><Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancelar</Button></div>
                  </div>
                ) : (
                  <button onClick={() => { setAdding(col.id); setAddTitle(''); setAddTpl(''); }} className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-xs text-wine/70 transition hover:bg-blush hover:text-wine"><Plus className="size-3.5" /> Adicionar tarefa</button>
                )}
              </Column>
            ))}
            <button onClick={() => setSettings(true)} className="flex w-60 shrink-0 snap-start items-center gap-2 rounded-3xl border border-dashed border-wine/30 px-4 py-4 text-sm text-wine/70 transition hover:bg-blush"><Plus className="size-4" /> Nova coluna</button>
          </div>
          <DragOverlay>{active ? <TaskCard task={active} ctx={ctx} dragging /> : null}</DragOverlay>
        </DndContext>
      )}
      {view === 'calendario' && <CalendarView tasks={visible} ctx={ctx} onOpen={setOpenId} />}
      {view === 'lista' && <ListView tasks={visible} ctx={ctx} columns={p.columns} onOpen={setOpenId} />}
      {view === 'semana' && <WeekView tasks={visible} ctx={ctx} onOpen={setOpenId} />}
      {view === 'atividades' && (
        <ul className="space-y-2">
          {p.activity.map((a) => (
            <li key={a.id}><button disabled={!a.task_id} onClick={() => a.task_id && setOpenId(a.task_id)} className="flex w-full gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm ring-1 ring-wine/10 transition enabled:hover:bg-blush-soft"><span className="w-28 shrink-0 text-xs text-ink/45">{new Date(a.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span className="text-ink/80">{a.detail || '—'}</span></button></li>
          ))}
          {p.activity.length === 0 && <li className="rounded-2xl border border-dashed border-wine/25 px-6 py-10 text-center text-sm text-ink/55">Sem atividades ainda.</li>}
        </ul>
      )}

      {openId && <TaskModal key={openId} taskId={openId} ownerId={p.ownerId} columnsByBoard={columnsByBoard} members={p.members} tags={p.tags} clients={p.clients} onClose={() => setOpenId(null)} />}
      {settings && <BoardSettingsModal board={p.board} columns={p.columns} members={p.members} tags={p.tags} clients={p.clients} recurrences={p.recurrences} onClose={() => setSettings(false)} />}
      {saveName !== null && (
        <Modal open onClose={() => setSaveName(null)} title="Salvar filtro" className="sm:!max-w-sm">
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ex.: Atrasadas da Carla" maxLength={60} autoFocus />
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSaveName(null)}>Cancelar</Button><Button disabled={!saveName.trim()} onClick={async () => { const r = await saveFilter(p.board.id, saveName, { ...filters, hideDone: undefined }); if (!r.ok) return toast(r.error, 'error'); toast('Filtro salvo ♡'); setSaveName(null); router.refresh(); }}>Salvar</Button></div>
        </Modal>
      )}
    </div>
  );
}

function Column({ col, ids, byId, ctx, onOpen, done, children }: { col: ColumnRow; ids: string[]; byId: Map<string, TaskLite>; ctx: ReturnType<typeof buildCardCtx>; onOpen: (id: string) => void; done: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section className={cn('w-[82vw] max-w-[19.5rem] shrink-0 snap-start rounded-3xl bg-blush/55 p-2.5 ring-1 ring-wine/10 transition sm:w-72', isOver && 'bg-blush ring-wine/40')} aria-label={col.name}>
      <header className="mb-2 flex items-center justify-between gap-2 px-2 pt-1">
        <h2 className="label flex min-w-0 items-center gap-2 text-wine"><span className="truncate">{col.name}</span><span className="rounded-full bg-white px-2 py-0.5 text-[0.65rem] text-ink/55">{ids.length}</span></h2>
        {done && <span className="text-[0.6rem] uppercase tracking-wider text-ink/35">concluído</span>}
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-12 space-y-2">
          {ids.map((id) => {
            const t = byId.get(id);
            return t ? <SortableCard key={id} task={t} ctx={ctx} onOpen={() => onOpen(id)} /> : null;
          })}
        </div>
      </SortableContext>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SortableCard({ task, ctx, onOpen }: { task: TaskLite; ctx: ReturnType<typeof buildCardCtx>; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('relative', isDragging && 'opacity-30')} {...attributes} {...listeners}>
      <TaskCard task={task} ctx={ctx} onOpen={onOpen} />
      <GripVertical className="pointer-events-none absolute right-1 top-1/2 size-3.5 -translate-y-1/2 text-wine/0 transition group-hover:text-wine/30" aria-hidden />
    </div>
  );
}
