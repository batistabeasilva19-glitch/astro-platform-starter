'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/clients';
import { loadTaskDetail, logProd, nextRun, type TaskDetail } from '@/lib/data/production';
import { removeFiles } from '@/lib/storage';
import { addDays, todayBR } from '@/lib/perf/calc';
import { isIsoDate } from '@/lib/perf/validate';
import { BOARD_TEMPLATES, CATEGORIES, CHECKLIST_TEMPLATE_BY_ID, COLUMN_KINDS, DONE_KINDS, LINK_TYPES, PRIORITIES, TASK_TEMPLATES, type BoardSettings, type ColumnKind } from '@/lib/production/types';
import { fail, type ActionResult } from './shared';

const MISSING = 'Não foi possível salvar. A migration 0011 foi aplicada no Supabase? (supabase/migrations/0011_producao.sql)';
const refresh = () => revalidatePath('/admin', 'layout');
const trim = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITY_IDS: string[] = PRIORITIES.map((p) => p.id);
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const KIND_IDS: string[] = COLUMN_KINDS.map((k) => k.id);

type Supa = Awaited<ReturnType<typeof createClient>>;

async function ctx() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
  const actor = (data?.name as string | undefined)?.trim() || user.email?.split('@')[0] || 'Soltria';
  return { user, supabase, actor };
}

async function taskOf(supabase: Supa, taskId: string) {
  const { data } = await supabase.from('prod_tasks').select('id, board_id, column_id, title, client_id, due_date, start_date').eq('id', taskId).maybeSingle();
  return data as { id: string; board_id: string; column_id: string; title: string; client_id: string | null; due_date: string | null; start_date: string | null } | null;
}
const endPosition = async (supabase: Supa, columnId: string) => {
  const { data } = await supabase.from('prod_tasks').select('position').eq('column_id', columnId).order('position', { ascending: false }).limit(1);
  return ((data?.[0]?.position as number | undefined) ?? 0) + 1000;
};
/** A relação existe e pertence à administradora (RLS filtra o resto). */
async function exists(supabase: Supa, table: string, id: string) {
  const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  return !!data;
}

// ─── quadros ──────────────────────────────────────────────────────────────

export async function createBoard(input: { name: string; description?: string; template?: string; client_id?: string | null }): Promise<ActionResult<{ id: string }>> {
  const { user, supabase, actor } = await ctx();
  const name = trim(input.name, 120);
  if (!name) return fail('Dê um nome ao quadro.');
  const tpl = BOARD_TEMPLATES.find((t) => t.id === input.template) ?? BOARD_TEMPLATES[0];
  if (input.client_id && !(await exists(supabase, 'clients', input.client_id))) return fail('Cliente não encontrado.');
  const { data: board, error } = await supabase.from('prod_boards').insert({ owner_id: user.id, name, description: trim(input.description, 500), client_id: input.client_id || null, settings: { sync_status: false, auto_create: false } }).select('id').single();
  if (error || !board) return fail(MISSING);
  await supabase.from('prod_columns').insert(tpl.columns.map((c, i) => ({ board_id: board.id, name: c.name, kind: c.kind, position: i })));
  await logProd(supabase, { boardId: board.id, actor, action: 'board', detail: `Quadro "${name}" criado` });
  refresh();
  return { ok: true, id: board.id };
}

export async function updateBoard(id: string, patch: { name?: string; description?: string; client_id?: string | null }): Promise<ActionResult> {
  const { supabase } = await ctx();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!trim(patch.name, 120)) return fail('Dê um nome ao quadro.');
    row.name = trim(patch.name, 120);
  }
  if (patch.description !== undefined) row.description = trim(patch.description, 500);
  if (patch.client_id !== undefined) row.client_id = patch.client_id || null;
  const { error } = await supabase.from('prod_boards').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}

export async function setBoardFlag(id: string, flag: 'favorite' | 'archived', value: boolean): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_boards').update({ [flag]: value }).eq('id', id);
  if (error) return fail('Não foi possível atualizar o quadro.');
  refresh();
  return { ok: true };
}

export async function deleteBoard(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: files } = await supabase.from('prod_attachments').select('storage_path, prod_tasks!inner(board_id)').eq('prod_tasks.board_id', id).not('storage_path', 'is', null);
  const { error } = await supabase.from('prod_boards').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir o quadro.');
  await removeFiles((files ?? []).map((f) => f.storage_path as string));
  refresh();
  return { ok: true };
}

export async function saveBoardSettings(id: string, patch: BoardSettings): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: b } = await supabase.from('prod_boards').select('settings').eq('id', id).maybeSingle();
  if (!b) return fail('Quadro não encontrado.');
  const next: BoardSettings = { ...(b.settings as BoardSettings), ...patch };
  if (next.auto_create_column_id) {
    const { data: col } = await supabase.from('prod_columns').select('id').eq('id', next.auto_create_column_id).eq('board_id', id).maybeSingle();
    if (!col) next.auto_create_column_id = null;
  }
  const { error } = await supabase.from('prod_boards').update({ settings: next }).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}

/** Duplica o quadro (colunas e configurações; opcionalmente as tarefas, com checklists zeradas). */
export async function duplicateBoard(id: string, withTasks: boolean): Promise<ActionResult<{ id: string }>> {
  const { user, supabase, actor } = await ctx();
  const { data: b } = await supabase.from('prod_boards').select('*').eq('id', id).maybeSingle();
  if (!b) return fail('Quadro não encontrado.');
  const { data: nb, error } = await supabase.from('prod_boards').insert({ owner_id: user.id, name: `${b.name} (cópia)`, description: b.description, client_id: b.client_id, settings: { ...(b.settings as object), auto_create: false, auto_create_column_id: null } }).select('id').single();
  if (error || !nb) return fail(MISSING);
  const { data: cols } = await supabase.from('prod_columns').select('*').eq('board_id', id).order('position');
  const map = new Map<string, string>();
  for (const c of cols ?? []) {
    const { data: nc } = await supabase.from('prod_columns').insert({ board_id: nb.id, name: c.name, kind: c.kind, position: c.position }).select('id').single();
    if (nc) map.set(c.id as string, nc.id as string);
  }
  if (withTasks) {
    const { data: tasks } = await supabase.from('prod_tasks').select('id, column_id').eq('board_id', id).eq('archived', false).order('position');
    for (const t of tasks ?? []) await cloneTask(supabase, t.id as string, { boardId: nb.id, columnId: map.get(t.column_id as string), keepClient: true, keepDue: true, keepAssignees: true, titleSuffix: '' });
  }
  await logProd(supabase, { boardId: nb.id, actor, action: 'board', detail: `Quadro duplicado de "${b.name}"` });
  refresh();
  return { ok: true, id: nb.id };
}

// ─── colunas ──────────────────────────────────────────────────────────────

export async function addColumn(boardId: string, name: string, kind: string = 'custom'): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (!trim(name, 80)) return fail('Dê um nome à coluna.');
  const { data: last } = await supabase.from('prod_columns').select('position').eq('board_id', boardId).order('position', { ascending: false }).limit(1);
  const { error } = await supabase.from('prod_columns').insert({ board_id: boardId, name: trim(name, 80), kind: KIND_IDS.includes(kind) ? kind : 'custom', position: ((last?.[0]?.position as number | undefined) ?? -1) + 1 });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}

export async function updateColumn(id: string, patch: { name?: string; kind?: string }): Promise<ActionResult> {
  const { supabase } = await ctx();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!trim(patch.name, 80)) return fail('Dê um nome à coluna.');
    row.name = trim(patch.name, 80);
  }
  if (patch.kind !== undefined) row.kind = KIND_IDS.includes(patch.kind) ? patch.kind : 'custom';
  const { error } = await supabase.from('prod_columns').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}

export async function moveColumn(id: string, dir: -1 | 1): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: col } = await supabase.from('prod_columns').select('id, board_id').eq('id', id).maybeSingle();
  if (!col) return fail('Coluna não encontrada.');
  const { data: cols } = await supabase.from('prod_columns').select('id').eq('board_id', col.board_id).order('position');
  const order = (cols ?? []).map((c) => c.id as string);
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return { ok: true };
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((cid, pos) => supabase.from('prod_columns').update({ position: pos }).eq('id', cid)));
  refresh();
  return { ok: true };
}

export async function deleteColumn(id: string, moveToColumnId?: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: col } = await supabase.from('prod_columns').select('id, board_id, name').eq('id', id).maybeSingle();
  if (!col) return fail('Coluna não encontrada.');
  const { count } = await supabase.from('prod_tasks').select('id', { count: 'exact', head: true }).eq('column_id', id);
  if (count) {
    if (!moveToColumnId || moveToColumnId === id) return fail(`A coluna “${col.name}” tem ${count} ${count === 1 ? 'tarefa' : 'tarefas'}. Escolha para qual coluna movê-las antes de remover.`);
    const { data: dest } = await supabase.from('prod_columns').select('id').eq('id', moveToColumnId).eq('board_id', col.board_id).maybeSingle();
    if (!dest) return fail('Coluna de destino inválida.');
    let pos = await endPosition(supabase, moveToColumnId);
    const { data: tasks } = await supabase.from('prod_tasks').select('id').eq('column_id', id).order('position');
    for (const t of tasks ?? []) {
      await supabase.from('prod_tasks').update({ column_id: moveToColumnId, position: pos }).eq('id', t.id);
      pos += 1000;
    }
  }
  const { error } = await supabase.from('prod_columns').delete().eq('id', id);
  if (error) return fail('Não foi possível remover a coluna.');
  refresh();
  return { ok: true };
}

// ─── tarefas ──────────────────────────────────────────────────────────────

interface NewTask {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  client_id?: string | null;
  category?: string;
  priority?: string;
  start_date?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  content_id?: string | null;
  templateId?: string;
  assignee_ids?: string[];
  tag_ids?: string[];
}

async function insertTask(supabase: Supa, actor: string, input: NewTask): Promise<ActionResult<{ id: string }>> {
  const tpl = TASK_TEMPLATES.find((t) => t.id === input.templateId);
  const title = trim(input.title, 200) || tpl?.title || '';
  if (!title) return fail('Dê um título à tarefa.');
  if (input.client_id && !(await exists(supabase, 'clients', input.client_id))) return fail('Cliente não encontrado.');
  if (input.content_id && !(await exists(supabase, 'content_items', input.content_id))) return fail('Conteúdo não encontrado.');
  if (input.due_date && !isIsoDate(input.due_date)) return fail('Prazo inválido.');
  if (input.start_date && !isIsoDate(input.start_date)) return fail('Data de início inválida.');
  if (input.start_date && input.due_date && input.due_date < input.start_date) return fail('O prazo não pode ser anterior à data de início.');
  const { data: col } = await supabase.from('prod_columns').select('id, kind, name').eq('id', input.columnId).eq('board_id', input.boardId).maybeSingle();
  if (!col) return fail('Coluna não encontrada.');
  const category = tpl?.category ?? (CATEGORY_IDS.includes(input.category ?? '') ? input.category! : 'other');
  const priority = tpl?.priority ?? (PRIORITY_IDS.includes(input.priority ?? '') ? input.priority! : 'medium');
  const { data: task, error } = await supabase
    .from('prod_tasks')
    .insert({ board_id: input.boardId, column_id: input.columnId, position: await endPosition(supabase, input.columnId), title, description: trim(input.description, 8000), client_id: input.client_id || null, content_id: input.content_id || null, category, priority, start_date: input.start_date || null, due_date: input.due_date || null, due_time: input.due_time || null, source: tpl ? 'template' : 'manual', completed_at: DONE_KINDS.includes(col.kind as ColumnKind) ? new Date().toISOString() : null })
    .select('id')
    .single();
  if (error || !task) return fail(MISSING);
  if (tpl) {
    const ct = CHECKLIST_TEMPLATE_BY_ID[tpl.checklist];
    if (ct) {
      const { data: cl } = await supabase.from('prod_checklists').insert({ task_id: task.id, title: ct.title }).select('id').single();
      if (cl) await supabase.from('prod_checklist_items').insert(ct.items.map((text, i) => ({ checklist_id: cl.id, text, position: i })));
    }
    if (tpl.subtasks?.length) await supabase.from('prod_subtasks').insert(tpl.subtasks.map((s, i) => ({ task_id: task.id, title: s, position: i })));
  }
  if (input.assignee_ids?.length) await supabase.from('prod_task_assignees').insert([...new Set(input.assignee_ids)].map((member_id) => ({ task_id: task.id, member_id })));
  if (input.tag_ids?.length) await supabase.from('prod_task_tags').insert([...new Set(input.tag_ids)].map((tag_id) => ({ task_id: task.id, tag_id })));
  await logProd(supabase, { boardId: input.boardId, taskId: task.id, actor, action: 'created', detail: `${actor} criou a tarefa em "${col.name}"` });
  return { ok: true, id: task.id };
}

export async function createTask(input: NewTask): Promise<ActionResult<{ id: string }>> {
  const { supabase, actor } = await ctx();
  const r = await insertTask(supabase, actor, input);
  if (r.ok) refresh();
  return r;
}

/** Atalho global "+ Nova tarefa": cria no quadro escolhido (ou no primeiro quadro; se não houver, cria o quadro Produção). */
export async function quickCreateTask(input: { title: string; client_id?: string | null; due_date?: string | null; category?: string; board_id?: string | null; templateId?: string }): Promise<ActionResult<{ id: string; boardId: string }>> {
  const { user, supabase, actor } = await ctx();
  let boardId = input.board_id ?? null;
  if (!boardId) {
    const { data: boards, error } = await supabase.from('prod_boards').select('id').eq('archived', false).order('favorite', { ascending: false }).order('created_at').limit(1);
    if (error) return fail(MISSING);
    boardId = (boards?.[0]?.id as string | undefined) ?? null;
  }
  if (!boardId) {
    const created = await createBoard({ name: 'Produção', template: 'producao' });
    if (!created.ok) return created;
    boardId = created.id;
  }
  void user;
  const { data: cols } = await supabase.from('prod_columns').select('id, kind').eq('board_id', boardId).order('position');
  const col = (cols ?? []).find((c) => c.kind === 'todo') ?? cols?.[0];
  if (!col) return fail('O quadro não tem colunas.');
  const r = await insertTask(supabase, actor, { boardId, columnId: col.id as string, title: input.title, client_id: input.client_id, due_date: input.due_date, category: input.category, templateId: input.templateId });
  if (!r.ok) return r;
  refresh();
  return { ok: true, id: r.id, boardId };
}

type TaskPatch = Partial<{ title: string; description: string; client_id: string | null; project_name: string; content_id: string | null; identity_project_id: string | null; report_id: string | null; campaign_id: string | null; start_date: string | null; due_date: string | null; due_time: string | null; priority: string; category: string; internal_notes: string }>;

export async function updateTask(id: string, patch: TaskPatch): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  const cur = await taskOf(supabase, id);
  if (!cur) return fail('Tarefa não encontrada.');
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    if (!trim(patch.title, 200)) return fail('A tarefa precisa de um título.');
    row.title = trim(patch.title, 200);
  }
  if (patch.description !== undefined) row.description = trim(patch.description, 8000);
  if (patch.project_name !== undefined) row.project_name = trim(patch.project_name, 160);
  if (patch.internal_notes !== undefined) row.internal_notes = trim(patch.internal_notes, 4000);
  if (patch.priority !== undefined) {
    if (!PRIORITY_IDS.includes(patch.priority)) return fail('Prioridade inválida.');
    row.priority = patch.priority;
  }
  if (patch.category !== undefined) {
    if (!CATEGORY_IDS.includes(patch.category)) return fail('Categoria inválida.');
    row.category = patch.category;
  }
  for (const [key, table] of [['client_id', 'clients'], ['content_id', 'content_items'], ['identity_project_id', 'identity_projects'], ['report_id', 'perf_reports'], ['campaign_id', 'perf_campaigns']] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === null || v === '') row[key] = null;
    else if (!UUID.test(v) || !(await exists(supabase, table, v))) return fail('Vínculo não encontrado.');
    else row[key] = v;
  }
  for (const key of ['start_date', 'due_date'] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (!v) row[key] = null;
    else if (!isIsoDate(v)) return fail('Data inválida.');
    else row[key] = v;
  }
  if (patch.due_time !== undefined) {
    if (!patch.due_time) row.due_time = null;
    else if (!/^\d{2}:\d{2}$/.test(patch.due_time)) return fail('Horário inválido.');
    else row.due_time = patch.due_time;
  }
  const start = (row.start_date !== undefined ? row.start_date : cur.start_date) as string | null;
  const due = (row.due_date !== undefined ? row.due_date : cur.due_date) as string | null;
  if (start && due && due < start) return fail('O prazo não pode ser anterior à data de início.');
  const { error } = await supabase.from('prod_tasks').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar a tarefa.');
  if (row.due_date !== undefined && row.due_date !== cur.due_date) await logProd(supabase, { boardId: cur.board_id, taskId: id, actor, action: 'due', detail: `${actor} alterou o prazo para ${row.due_date ? String(row.due_date).split('-').reverse().join('/') : 'sem prazo'}` });
  if (row.client_id !== undefined && row.client_id !== cur.client_id) await logProd(supabase, { boardId: cur.board_id, taskId: id, actor, action: 'client', detail: `${actor} alterou o cliente da tarefa` });
  refresh();
  return { ok: true };
}

/** Arrastar e soltar: muda de coluna e/ou de posição (indexação fracionária) e registra no histórico. */
export async function moveTask(id: string, columnId: string, position: number): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  if (!Number.isFinite(position)) return fail('Posição inválida.');
  const cur = await taskOf(supabase, id);
  if (!cur) return fail('Tarefa não encontrada.');
  const { data: col } = await supabase.from('prod_columns').select('id, name, kind, board_id').eq('id', columnId).maybeSingle();
  if (!col || col.board_id !== cur.board_id) return fail('Coluna inválida.');
  const done = DONE_KINDS.includes(col.kind as ColumnKind);
  if (done && col.id !== cur.column_id) {
    const { data: board } = await supabase.from('prod_boards').select('settings').eq('id', cur.board_id).maybeSingle();
    if ((board?.settings as BoardSettings | undefined)?.require_checklist_for_done) {
      const { data: cls } = await supabase.from('prod_checklists').select('id').eq('task_id', id);
      const ids = (cls ?? []).map((c) => c.id as string);
      if (ids.length) {
        const { data: items } = await supabase.from('prod_checklist_items').select('done').in('checklist_id', ids);
        const open = (items ?? []).filter((i) => !i.done).length;
        if (open) return fail(`Conclua o checklist antes de mover para “${col.name}” (${open} ${open === 1 ? 'item falta' : 'itens faltam'}).`);
      }
    }
  }
  const patch: Record<string, unknown> = { column_id: columnId, position };
  if (col.id !== cur.column_id) patch.completed_at = done ? new Date().toISOString() : null;
  const { error } = await supabase.from('prod_tasks').update(patch).eq('id', id);
  if (error) return fail('Não foi possível mover a tarefa.');
  if (col.id !== cur.column_id) {
    const { data: from } = await supabase.from('prod_columns').select('name').eq('id', cur.column_id).maybeSingle();
    await logProd(supabase, { boardId: cur.board_id, taskId: id, actor, action: 'move', detail: `Movido de "${from?.name ?? '—'}" para "${col.name}"` });
  }
  refresh();
  return { ok: true };
}

export async function archiveTask(id: string, archived: boolean): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  const cur = await taskOf(supabase, id);
  if (!cur) return fail('Tarefa não encontrada.');
  const { error } = await supabase.from('prod_tasks').update({ archived }).eq('id', id);
  if (error) return fail('Não foi possível arquivar.');
  await logProd(supabase, { boardId: cur.board_id, taskId: id, actor, action: 'archive', detail: archived ? 'Tarefa arquivada' : 'Tarefa restaurada' });
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: files } = await supabase.from('prod_attachments').select('storage_path').eq('task_id', id).not('storage_path', 'is', null);
  const { error } = await supabase.from('prod_tasks').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  await removeFiles((files ?? []).map((f) => f.storage_path as string));
  refresh();
  return { ok: true };
}

interface CloneOpts {
  boardId?: string;
  columnId?: string;
  keepClient: boolean;
  keepDue: boolean;
  keepAssignees: boolean;
  titleSuffix?: string;
}
/** Copia descrição, checklist (zerado), tags e categoria; cliente, prazo e responsável só se pedido. */
async function cloneTask(supabase: Supa, id: string, o: CloneOpts): Promise<string | null> {
  const { data: t } = await supabase.from('prod_tasks').select('*').eq('id', id).maybeSingle();
  if (!t) return null;
  const columnId = o.columnId ?? t.column_id;
  const { data: nt } = await supabase
    .from('prod_tasks')
    .insert({ board_id: o.boardId ?? t.board_id, column_id: columnId, position: (o.boardId ? t.position : (t.position as number) + 1), title: `${t.title}${o.titleSuffix ?? ' (cópia)'}`, description: t.description, category: t.category, priority: t.priority, project_name: t.project_name, client_id: o.keepClient ? t.client_id : null, content_id: o.keepClient ? t.content_id : null, due_date: o.keepDue ? t.due_date : null, start_date: o.keepDue ? t.start_date : null, due_time: o.keepDue ? t.due_time : null, internal_notes: t.internal_notes })
    .select('id')
    .single();
  if (!nt) return null;
  const [tags, assignees, cls, subs] = await Promise.all([
    supabase.from('prod_task_tags').select('tag_id').eq('task_id', id),
    o.keepAssignees ? supabase.from('prod_task_assignees').select('member_id').eq('task_id', id) : { data: [] as { member_id: string }[] },
    supabase.from('prod_checklists').select('id, title, position').eq('task_id', id).order('position'),
    supabase.from('prod_subtasks').select('title, position, assignee_id, due_date').eq('task_id', id).order('position'),
  ]);
  if (tags.data?.length) await supabase.from('prod_task_tags').insert(tags.data.map((x) => ({ task_id: nt.id, tag_id: x.tag_id })));
  if (assignees.data?.length) await supabase.from('prod_task_assignees').insert(assignees.data.map((x) => ({ task_id: nt.id, member_id: x.member_id })));
  for (const c of cls.data ?? []) {
    const { data: ncl } = await supabase.from('prod_checklists').insert({ task_id: nt.id, title: c.title, position: c.position }).select('id').single();
    const { data: items } = await supabase.from('prod_checklist_items').select('text, position').eq('checklist_id', c.id).order('position');
    if (ncl && items?.length) await supabase.from('prod_checklist_items').insert(items.map((i) => ({ checklist_id: ncl.id, text: i.text, position: i.position })));
  }
  if (subs.data?.length) await supabase.from('prod_subtasks').insert(subs.data.map((s) => ({ task_id: nt.id, title: s.title, position: s.position, assignee_id: o.keepAssignees ? s.assignee_id : null, due_date: o.keepDue ? s.due_date : null })));
  return nt.id as string;
}

export async function duplicateTask(id: string, opts: { keepClient: boolean; keepDue: boolean; keepAssignees: boolean }): Promise<ActionResult<{ id: string }>> {
  const { supabase, actor } = await ctx();
  const cur = await taskOf(supabase, id);
  if (!cur) return fail('Tarefa não encontrada.');
  const nid = await cloneTask(supabase, id, opts);
  if (!nid) return fail('Não foi possível duplicar.');
  await logProd(supabase, { boardId: cur.board_id, taskId: nid, actor, action: 'created', detail: `Duplicada de "${cur.title}"` });
  refresh();
  return { ok: true, id: nid };
}

export async function getTaskDetail(id: string): Promise<ActionResult<{ detail: TaskDetail }>> {
  const { supabase } = await ctx();
  const detail = await loadTaskDetail(supabase, id);
  if (!detail) return fail('Tarefa não encontrada.');
  return { ok: true, detail };
}

// ─── responsáveis e tags ─────────────────────────────────────────────────

export async function setAssignees(taskId: string, memberIds: string[]): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  const cur = await taskOf(supabase, taskId);
  if (!cur) return fail('Tarefa não encontrada.');
  const ids = [...new Set(memberIds)];
  if (ids.length) {
    const { data: ok } = await supabase.from('prod_members').select('id, name').in('id', ids);
    if ((ok ?? []).length !== ids.length) return fail('Responsável inválido.');
    await logProd(supabase, { boardId: cur.board_id, taskId, actor, action: 'assign', detail: `Responsáveis: ${(ok ?? []).map((m) => m.name).join(', ')}` });
  } else await logProd(supabase, { boardId: cur.board_id, taskId, actor, action: 'assign', detail: 'Responsáveis removidos' });
  await supabase.from('prod_task_assignees').delete().eq('task_id', taskId);
  if (ids.length) await supabase.from('prod_task_assignees').insert(ids.map((member_id) => ({ task_id: taskId, member_id })));
  refresh();
  return { ok: true };
}

export async function addMember(input: { name: string; role?: string; color?: string }): Promise<ActionResult<{ id: string }>> {
  const { user, supabase } = await ctx();
  const name = trim(input.name, 80);
  if (!name) return fail('Dê um nome ao membro.');
  const { data, error } = await supabase.from('prod_members').insert({ owner_id: user.id, name, role: trim(input.role, 60), color: /^#[0-9a-f]{6}$/i.test(input.color ?? '') ? input.color : '#771430' }).select('id').single();
  if (error || !data) return fail(MISSING);
  refresh();
  return { ok: true, id: data.id };
}
export async function removeMember(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: m } = await supabase.from('prod_members').select('user_id').eq('id', id).maybeSingle();
  if (m?.user_id) return fail('O seu próprio perfil não pode ser removido.');
  const { error } = await supabase.from('prod_members').delete().eq('id', id);
  if (error) return fail('Não foi possível remover.');
  refresh();
  return { ok: true };
}

export async function createTag(name: string, color: string): Promise<ActionResult<{ id: string }>> {
  const { user, supabase } = await ctx();
  const n = trim(name, 40);
  if (!n) return fail('Dê um nome à tag.');
  const { data: ex } = await supabase.from('prod_tags').select('id').eq('owner_id', user.id).ilike('name', n).maybeSingle();
  if (ex) return { ok: true, id: ex.id as string };
  const { data, error } = await supabase.from('prod_tags').insert({ owner_id: user.id, name: n, color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#771430' }).select('id').single();
  if (error || !data) return fail(MISSING);
  refresh();
  return { ok: true, id: data.id };
}
export async function updateTag(id: string, patch: { name?: string; color?: string }): Promise<ActionResult> {
  const { supabase } = await ctx();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = trim(patch.name, 40);
  if (patch.color !== undefined && /^#[0-9a-f]{6}$/i.test(patch.color)) row.color = patch.color;
  const { error } = await supabase.from('prod_tags').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar a tag.');
  refresh();
  return { ok: true };
}
export async function deleteTag(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_tags').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir a tag.');
  refresh();
  return { ok: true };
}
export async function setTaskTags(taskId: string, tagIds: string[]): Promise<ActionResult> {
  const { supabase } = await ctx();
  const cur = await taskOf(supabase, taskId);
  if (!cur) return fail('Tarefa não encontrada.');
  const ids = [...new Set(tagIds)];
  if (ids.length) {
    const { data: ok } = await supabase.from('prod_tags').select('id').in('id', ids);
    if ((ok ?? []).length !== ids.length) return fail('Tag inválida.');
  }
  await supabase.from('prod_task_tags').delete().eq('task_id', taskId);
  if (ids.length) await supabase.from('prod_task_tags').insert(ids.map((tag_id) => ({ task_id: taskId, tag_id })));
  refresh();
  return { ok: true };
}

// ─── checklists e subtarefas ─────────────────────────────────────────────

export async function addChecklist(taskId: string, input: { title?: string; templateId?: string }): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  const cur = await taskOf(supabase, taskId);
  if (!cur) return fail('Tarefa não encontrada.');
  const tpl = input.templateId ? CHECKLIST_TEMPLATE_BY_ID[input.templateId] : undefined;
  const title = trim(input.title, 80) || tpl?.title || 'Checklist';
  const { data: last } = await supabase.from('prod_checklists').select('position').eq('task_id', taskId).order('position', { ascending: false }).limit(1);
  const { data: cl, error } = await supabase.from('prod_checklists').insert({ task_id: taskId, title, position: ((last?.[0]?.position as number | undefined) ?? -1) + 1 }).select('id').single();
  if (error || !cl) return fail(MISSING);
  if (tpl) await supabase.from('prod_checklist_items').insert(tpl.items.map((text, i) => ({ checklist_id: cl.id, text, position: i })));
  await logProd(supabase, { boardId: cur.board_id, taskId, actor, action: 'checklist', detail: `Checklist "${title}" adicionada` });
  refresh();
  return { ok: true };
}
export async function renameChecklist(id: string, title: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (!trim(title, 80)) return fail('Dê um nome à checklist.');
  const { error } = await supabase.from('prod_checklists').update({ title: trim(title, 80) }).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  return { ok: true };
}
export async function deleteChecklist(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_checklists').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}
export async function addChecklistItem(checklistId: string, text: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (!trim(text, 200)) return fail('Escreva o item.');
  const { data: last } = await supabase.from('prod_checklist_items').select('position').eq('checklist_id', checklistId).order('position', { ascending: false }).limit(1);
  const { error } = await supabase.from('prod_checklist_items').insert({ checklist_id: checklistId, text: trim(text, 200), position: ((last?.[0]?.position as number | undefined) ?? -1) + 1 });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
export async function updateChecklistItem(id: string, patch: { done?: boolean; text?: string }): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  const row: Record<string, unknown> = {};
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.text !== undefined) {
    if (!trim(patch.text, 200)) return fail('O item não pode ficar vazio.');
    row.text = trim(patch.text, 200);
  }
  const { data: item, error } = await supabase.from('prod_checklist_items').update(row).eq('id', id).select('text, checklist_id').single();
  if (error || !item) return fail('Não foi possível salvar.');
  if (patch.done !== undefined) {
    const { data: cl } = await supabase.from('prod_checklists').select('task_id').eq('id', item.checklist_id).maybeSingle();
    const t = cl ? await taskOf(supabase, cl.task_id as string) : null;
    if (t && patch.done) await logProd(supabase, { boardId: t.board_id, taskId: t.id, actor, action: 'checklist', detail: `Checklist: "${item.text}" concluído` });
  }
  refresh();
  return { ok: true };
}
export async function deleteChecklistItem(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_checklist_items').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

export async function addSubtask(taskId: string, title: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  if (!trim(title, 200)) return fail('Escreva a subtarefa.');
  const { data: last } = await supabase.from('prod_subtasks').select('position').eq('task_id', taskId).order('position', { ascending: false }).limit(1);
  const { error } = await supabase.from('prod_subtasks').insert({ task_id: taskId, title: trim(title, 200), position: ((last?.[0]?.position as number | undefined) ?? -1) + 1 });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
export async function updateSubtask(id: string, patch: { title?: string; status?: string; assignee_id?: string | null; due_date?: string | null }): Promise<ActionResult> {
  const { supabase } = await ctx();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    if (!trim(patch.title, 200)) return fail('A subtarefa precisa de um título.');
    row.title = trim(patch.title, 200);
  }
  if (patch.status !== undefined) {
    if (!['todo', 'doing', 'done'].includes(patch.status)) return fail('Status inválido.');
    row.status = patch.status;
  }
  if (patch.assignee_id !== undefined) row.assignee_id = patch.assignee_id || null;
  if (patch.due_date !== undefined) {
    if (patch.due_date && !isIsoDate(patch.due_date)) return fail('Data inválida.');
    row.due_date = patch.due_date || null;
  }
  const { error } = await supabase.from('prod_subtasks').update(row).eq('id', id);
  if (error) return fail('Não foi possível salvar.');
  refresh();
  return { ok: true };
}
export async function deleteSubtask(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_subtasks').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

// ─── comentários, anexos e links ─────────────────────────────────────────

export async function addComment(taskId: string, body: string): Promise<ActionResult> {
  const { supabase, actor, user } = await ctx();
  const text = trim(body, 4000);
  if (!text) return fail('Escreva o comentário.');
  const cur = await taskOf(supabase, taskId);
  if (!cur) return fail('Tarefa não encontrada.');
  const { data: member } = await supabase.from('prod_members').select('id').eq('user_id', user.id).maybeSingle();
  const { error } = await supabase.from('prod_comments').insert({ task_id: taskId, member_id: member?.id ?? null, author_name: actor, body: text });
  if (error) return fail(MISSING);
  await logProd(supabase, { boardId: cur.board_id, taskId, actor, action: 'comment', detail: `${actor} comentou` });
  refresh();
  return { ok: true };
}
export async function deleteComment(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_comments').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

export async function addAttachmentLink(taskId: string, input: { url: string; name?: string; link_type?: string }): Promise<ActionResult> {
  const { supabase, actor } = await ctx();
  const url = trim(input.url, 1000);
  if (!/^https?:\/\/\S+$/i.test(url)) return fail('Cole um link completo, começando com https://');
  const cur = await taskOf(supabase, taskId);
  if (!cur) return fail('Tarefa não encontrada.');
  const type = LINK_TYPES.some((l) => l.id === input.link_type) ? input.link_type! : 'other';
  const { error } = await supabase.from('prod_attachments').insert({ task_id: taskId, kind: 'link', name: trim(input.name, 160) || url.replace(/^https?:\/\//i, '').slice(0, 60), url, link_type: type });
  if (error) return fail(MISSING);
  await logProd(supabase, { boardId: cur.board_id, taskId, actor, action: 'attach', detail: 'Link adicionado' });
  refresh();
  return { ok: true };
}
export async function registerAttachmentFile(taskId: string, input: { path: string; name: string; mime: string; size: number }): Promise<ActionResult> {
  const { supabase, actor, user } = await ctx();
  if (!input.path.startsWith(`${user.id}/producao/${taskId}/`)) return fail('Caminho de arquivo inválido.');
  const cur = await taskOf(supabase, taskId);
  if (!cur) return fail('Tarefa não encontrada.');
  const { error } = await supabase.from('prod_attachments').insert({ task_id: taskId, kind: 'file', name: trim(input.name, 200), storage_path: input.path, mime_type: trim(input.mime, 100), size_bytes: Number.isFinite(input.size) ? input.size : null });
  if (error) return fail(MISSING);
  await logProd(supabase, { boardId: cur.board_id, taskId, actor, action: 'attach', detail: `Arquivo "${trim(input.name, 80)}" anexado` });
  refresh();
  return { ok: true };
}
export async function deleteAttachment(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { data: a } = await supabase.from('prod_attachments').select('storage_path').eq('id', id).maybeSingle();
  const { error } = await supabase.from('prod_attachments').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  if (a?.storage_path) await removeFiles([a.storage_path as string]);
  refresh();
  return { ok: true };
}

// ─── recorrência e filtros salvos ────────────────────────────────────────

export async function saveRecurrence(boardId: string, input: { id?: string; title: string; description?: string; column_id: string; client_id?: string | null; category?: string; priority?: string; cadence: string; weekday?: number; month_day?: number; every_days?: number; due_offset?: number }): Promise<ActionResult> {
  const { supabase } = await ctx();
  const title = trim(input.title, 200);
  if (!title) return fail('Dê um título à tarefa recorrente.');
  if (!['daily', 'weekly', 'monthly', 'custom'].includes(input.cadence)) return fail('Escolha a frequência.');
  const { data: col } = await supabase.from('prod_columns').select('id').eq('id', input.column_id).eq('board_id', boardId).maybeSingle();
  if (!col) return fail('Coluna não encontrada.');
  const today = todayBR();
  const weekday = input.cadence === 'weekly' ? Math.min(6, Math.max(0, Math.round(input.weekday ?? 1))) : null;
  const monthDay = input.cadence === 'monthly' ? Math.min(31, Math.max(1, Math.round(input.month_day ?? 1))) : null;
  const every = input.cadence === 'custom' ? Math.min(365, Math.max(1, Math.round(input.every_days ?? 7))) : null;
  // primeira execução: a próxima data que combina com a regra (a partir de hoje)
  let first = today;
  if (input.cadence === 'weekly') {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    first = addDays(today, (weekday! - dow + 7) % 7);
  } else if (input.cadence === 'monthly') {
    const [y, m] = today.split('-').map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cand = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(monthDay!, dim)).padStart(2, '0')}`;
    first = cand >= today ? cand : nextRun({ cadence: 'monthly', weekday: null, month_day: monthDay, every_days: null }, today);
  }
  const row = { board_id: boardId, column_id: input.column_id, title, description: trim(input.description, 4000), client_id: input.client_id || null, category: CATEGORY_IDS.includes(input.category ?? '') ? input.category : 'other', priority: PRIORITY_IDS.includes(input.priority ?? '') ? input.priority : 'medium', cadence: input.cadence, weekday, month_day: monthDay, every_days: every, due_offset: Math.min(60, Math.max(0, Math.round(input.due_offset ?? 0))) };
  const { error } = input.id ? await supabase.from('prod_recurrences').update(row).eq('id', input.id) : await supabase.from('prod_recurrences').insert({ ...row, next_run: first });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
export async function setRecurrenceActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_recurrences').update({ active }).eq('id', id);
  if (error) return fail('Não foi possível atualizar.');
  refresh();
  return { ok: true };
}
export async function deleteRecurrence(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_recurrences').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}

export async function saveFilter(boardId: string | null, name: string, filter: Record<string, unknown>): Promise<ActionResult> {
  const { user, supabase } = await ctx();
  const n = trim(name, 60);
  if (!n) return fail('Dê um nome ao filtro.');
  const { error } = await supabase.from('prod_saved_filters').insert({ owner_id: user.id, board_id: boardId, name: n, filter });
  if (error) return fail(MISSING);
  refresh();
  return { ok: true };
}
export async function deleteFilter(id: string): Promise<ActionResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.from('prod_saved_filters').delete().eq('id', id);
  if (error) return fail('Não foi possível excluir.');
  refresh();
  return { ok: true };
}


/** Opções para vincular a tarefa a algo que já existe (conteúdos, identidades, relatórios e campanhas do cliente). */
export async function getRelationOptions(clientId: string): Promise<ActionResult<{ contents: { id: string; title: string; format: string; date: string | null }[]; identities: { id: string; name: string }[]; reports: { id: string; month: string }[]; campaigns: { id: string; name: string }[] }>> {
  const { supabase } = await ctx();
  if (!UUID.test(clientId)) return fail('Cliente inválido.');
  const [c, i, r, k] = await Promise.all([
    supabase.from('content_items').select('id, title, format, scheduled_date').eq('client_id', clientId).order('scheduled_date', { ascending: false, nullsFirst: false }).limit(200),
    supabase.from('identity_projects').select('id, name').eq('client_id', clientId),
    supabase.from('perf_reports').select('id, month').eq('client_id', clientId).order('month', { ascending: false }),
    supabase.from('perf_campaigns').select('id, name').eq('client_id', clientId),
  ]);
  return {
    ok: true,
    contents: (c.data ?? []).map((x) => ({ id: x.id as string, title: x.title as string, format: x.format as string, date: (x.scheduled_date as string | null) ?? null })),
    identities: (i.data ?? []) as { id: string; name: string }[],
    reports: (r.error ? [] : (r.data ?? [])) as { id: string; month: string }[],
    campaigns: (k.error ? [] : (k.data ?? [])) as { id: string; name: string }[],
  };
}

/** Opções do atalho global "+ Nova tarefa" (carregadas só quando o painel abre). */
export async function getQuickTaskOptions(): Promise<ActionResult<{ boards: { id: string; name: string }[]; clients: { id: string; name: string }[] }>> {
  const { supabase } = await ctx();
  const [b, c] = await Promise.all([supabase.from('prod_boards').select('id, name').eq('archived', false).order('favorite', { ascending: false }).order('created_at'), supabase.from('clients').select('id, company_name').order('company_name')]);
  if (b.error) return fail(MISSING);
  return { ok: true, boards: (b.data ?? []) as { id: string; name: string }[], clients: (c.data ?? []).map((x) => ({ id: x.id as string, name: x.company_name as string })) };
}
