import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, todayBR } from '@/lib/perf/calc';
import { signPaths } from '@/lib/storage';
import {
  CHECKLIST_TEMPLATE_BY_ID,
  DEFAULT_COLUMNS,
  DONE_KINDS,
  FORMAT_TO_CATEGORY,
  type BoardRow,
  type ClientLite,
  type ColumnKind,
  type ColumnRow,
  type MemberRow,
  type Priority,
  type TagRow,
  type TaskLite,
} from '@/lib/production/types';

/** PRODUÇÃO — leitura de dados, sincronização com conteúdos e tarefas automáticas/recorrentes. */

const chunk = <T,>(arr: T[], n = 80) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
async function inChunks<T>(ids: string[], run: (part: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunk(ids)) out.push(...((await run(part)).data ?? []));
  return out;
}

/** Garante que a administradora exista como membro da equipe (responsável padrão). */
export async function ensureMember(db: SupabaseClient, user: { id: string; email: string | null }): Promise<MemberRow[]> {
  const { data, error } = await db.from('prod_members').select('id, name, role, color, user_id').eq('owner_id', user.id).order('created_at');
  if (error) return [];
  if (data && data.length) return data as MemberRow[];
  const { data: profile } = await db.from('users').select('name').eq('id', user.id).maybeSingle();
  const name = (profile?.name as string | undefined)?.trim() || user.email?.split('@')[0] || 'Eu';
  const { data: created } = await db.from('prod_members').insert({ owner_id: user.id, user_id: user.id, name, role: 'Administradora' }).select('id, name, role, color, user_id');
  return (created ?? []) as MemberRow[];
}

/** Transforma tarefas em "cartões leves" com contadores (checklist, subtarefas, comentários, anexos) e vínculos. */
export async function enrichTasks(db: SupabaseClient, rows: Record<string, unknown>[]): Promise<TaskLite[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as string);
  const [assignees, tags, checklists, subtasks, comments, attachments] = await Promise.all([
    inChunks<{ task_id: string; member_id: string }>(ids, (p) => db.from('prod_task_assignees').select('task_id, member_id').in('task_id', p)),
    inChunks<{ task_id: string; tag_id: string }>(ids, (p) => db.from('prod_task_tags').select('task_id, tag_id').in('task_id', p)),
    inChunks<{ id: string; task_id: string }>(ids, (p) => db.from('prod_checklists').select('id, task_id').in('task_id', p)),
    inChunks<{ task_id: string; status: string }>(ids, (p) => db.from('prod_subtasks').select('task_id, status').in('task_id', p)),
    inChunks<{ task_id: string }>(ids, (p) => db.from('prod_comments').select('task_id').in('task_id', p)),
    inChunks<{ task_id: string }>(ids, (p) => db.from('prod_attachments').select('task_id').in('task_id', p)),
  ]);
  const items = await inChunks<{ checklist_id: string; done: boolean }>(
    checklists.map((c) => c.id),
    (p) => db.from('prod_checklist_items').select('checklist_id, done').in('checklist_id', p),
  );
  const taskOfChecklist = new Map(checklists.map((c) => [c.id, c.task_id]));
  const by = <T extends { task_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(x.task_id, [...(m.get(x.task_id) ?? []), x]);
    return m;
  };
  const aBy = by(assignees);
  const tBy = by(tags);
  const sBy = by(subtasks);
  const cBy = by(comments);
  const atBy = by(attachments);
  const clProgress = new Map<string, { done: number; total: number }>();
  for (const it of items) {
    const tid = taskOfChecklist.get(it.checklist_id);
    if (!tid) continue;
    const cur = clProgress.get(tid) ?? { done: 0, total: 0 };
    cur.total++;
    if (it.done) cur.done++;
    clProgress.set(tid, cur);
  }
  return rows.map((r) => {
    const id = r.id as string;
    const subs = sBy.get(id) ?? [];
    return {
      id,
      board_id: r.board_id as string,
      column_id: r.column_id as string,
      position: r.position as number,
      title: r.title as string,
      description: ((r.description as string) ?? '').slice(0, 400),
      client_id: (r.client_id as string | null) ?? null,
      category: r.category as string,
      priority: r.priority as Priority,
      start_date: (r.start_date as string | null) ?? null,
      due_date: (r.due_date as string | null) ?? null,
      due_time: (r.due_time as string | null) ?? null,
      archived: !!r.archived,
      completed_at: (r.completed_at as string | null) ?? null,
      content_id: (r.content_id as string | null) ?? null,
      source: r.source as string,
      created_at: r.created_at as string,
      tag_ids: (tBy.get(id) ?? []).map((x) => x.tag_id),
      assignee_ids: (aBy.get(id) ?? []).map((x) => x.member_id),
      checklist: clProgress.get(id) ?? { done: 0, total: 0 },
      subtasks: { done: subs.filter((s) => s.status === 'done').length, total: subs.length },
      comments: (cBy.get(id) ?? []).length,
      attachments: (atBy.get(id) ?? []).length,
    };
  });
}

export async function listClientsLite(db: SupabaseClient): Promise<ClientLite[]> {
  const { data } = await db.from('clients').select('id, company_name').order('company_name');
  return (data ?? []).map((c) => ({ id: c.id as string, name: c.company_name as string }));
}
export async function listTags(db: SupabaseClient): Promise<TagRow[]> {
  const { data } = await db.from('prod_tags').select('id, name, color').order('name');
  return (data ?? []) as TagRow[];
}

/** Quadro completo: colunas, tarefas (cartões leves), equipe, tags e clientes. `missing` = migration 0011 pendente. */
export async function loadBoard(db: SupabaseClient, user: { id: string; email: string | null }, boardId: string, opts: { archived?: boolean } = {}) {
  const { data: board, error } = await db.from('prod_boards').select('*').eq('id', boardId).maybeSingle();
  if (error) return { missing: true as const };
  if (!board) return { missing: false as const, board: null };
  await runRecurrences(db, boardId).catch(() => {});
  const [colsRes, tasksRes, members, tags, clients] = await Promise.all([
    db.from('prod_columns').select('*').eq('board_id', boardId).order('position'),
    (() => {
      let q = db.from('prod_tasks').select('*').eq('board_id', boardId);
      if (!opts.archived) q = q.eq('archived', false);
      return q.order('position');
    })(),
    ensureMember(db, user),
    listTags(db),
    listClientsLite(db),
  ]);
  const tasks = await enrichTasks(db, (tasksRes.data ?? []) as Record<string, unknown>[]);
  return { missing: false as const, board: board as BoardRow, columns: (colsRes.data ?? []) as ColumnRow[], tasks, members, tags, clients };
}

/** Tarefas de todos os quadros ativos (lista global, minhas tarefas, dashboard, métricas). */
export async function loadAllTasks(db: SupabaseClient, opts: { clientId?: string } = {}) {
  const { data: boards, error } = await db.from('prod_boards').select('id, name, archived, client_id, favorite').eq('archived', false);
  if (error) return { missing: true as const };
  const boardIds = (boards ?? []).map((b) => b.id as string);
  if (!boardIds.length) return { missing: false as const, boards: [], columns: [] as ColumnRow[], tasks: [] as TaskLite[] };
  const [cols, rows] = await Promise.all([
    db.from('prod_columns').select('*').in('board_id', boardIds).order('position'),
    (() => {
      let q = db.from('prod_tasks').select('*').in('board_id', boardIds).eq('archived', false);
      if (opts.clientId) q = q.eq('client_id', opts.clientId);
      return q.order('due_date', { ascending: true, nullsFirst: false });
    })(),
  ]);
  const tasks = await enrichTasks(db, (rows.data ?? []) as Record<string, unknown>[]);
  return { missing: false as const, boards: (boards ?? []) as { id: string; name: string; archived: boolean; client_id: string | null; favorite: boolean }[], columns: (cols.data ?? []) as ColumnRow[], tasks };
}

// ─── detalhe de uma tarefa (modal) ──────────────────────────────────
export interface TaskDetail {
  task: Record<string, unknown> & { id: string; title: string; description: string; board_id: string; column_id: string; client_id: string | null; content_id: string | null; identity_project_id: string | null; report_id: string | null; campaign_id: string | null; internal_notes: string; project_name: string; archived: boolean; priority: Priority; category: string; start_date: string | null; due_date: string | null; due_time: string | null; created_at: string; completed_at: string | null; source: string };
  assignee_ids: string[];
  tag_ids: string[];
  checklists: { id: string; title: string; items: { id: string; text: string; done: boolean }[] }[];
  subtasks: { id: string; title: string; status: string; assignee_id: string | null; due_date: string | null }[];
  comments: { id: string; author_name: string; body: string; created_at: string }[];
  attachments: { id: string; kind: string; name: string; url: string; link_type: string; mime_type: string; size_bytes: number | null; created_at: string; signed: string | null }[];
  activity: { id: string; actor_name: string; action: string; detail: string; created_at: string }[];
  links: { content: { id: string; title: string; format: string; status: string } | null; identity: { id: string; name: string } | null; report: { id: string; month: string; client_id: string } | null; campaign: { id: string; name: string } | null; client: { id: string; name: string } | null };
}

export async function loadTaskDetail(db: SupabaseClient, taskId: string): Promise<TaskDetail | null> {
  const { data: task } = await db.from('prod_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return null;
  const t = task as TaskDetail['task'];
  const [as, tg, cls, subs, com, att, act] = await Promise.all([
    db.from('prod_task_assignees').select('member_id').eq('task_id', taskId),
    db.from('prod_task_tags').select('tag_id').eq('task_id', taskId),
    db.from('prod_checklists').select('id, title, position').eq('task_id', taskId).order('position'),
    db.from('prod_subtasks').select('id, title, status, assignee_id, due_date').eq('task_id', taskId).order('position'),
    db.from('prod_comments').select('id, author_name, body, created_at').eq('task_id', taskId).order('created_at'),
    db.from('prod_attachments').select('*').eq('task_id', taskId).order('created_at'),
    db.from('prod_activity').select('id, actor_name, action, detail, created_at').eq('task_id', taskId).order('created_at', { ascending: false }).limit(60),
  ]);
  const clIds = (cls.data ?? []).map((c) => c.id as string);
  const items = clIds.length ? ((await db.from('prod_checklist_items').select('id, checklist_id, text, done, position').in('checklist_id', clIds).order('position')).data ?? []) : [];
  const files = (att.data ?? []).filter((a) => a.kind === 'file' && a.storage_path).map((a) => a.storage_path as string);
  const signed = await signPaths(files);
  const [content, identity, report, campaign, client] = await Promise.all([
    t.content_id ? db.from('content_items').select('id, title, format, status').eq('id', t.content_id).maybeSingle() : { data: null },
    t.identity_project_id ? db.from('identity_projects').select('id, name').eq('id', t.identity_project_id).maybeSingle() : { data: null },
    t.report_id ? db.from('perf_reports').select('id, month, client_id').eq('id', t.report_id).maybeSingle() : { data: null },
    t.campaign_id ? db.from('perf_campaigns').select('id, name').eq('id', t.campaign_id).maybeSingle() : { data: null },
    t.client_id ? db.from('clients').select('id, company_name').eq('id', t.client_id).maybeSingle() : { data: null },
  ]);
  return {
    task: t,
    assignee_ids: (as.data ?? []).map((x) => x.member_id as string),
    tag_ids: (tg.data ?? []).map((x) => x.tag_id as string),
    checklists: (cls.data ?? []).map((c) => ({ id: c.id as string, title: c.title as string, items: items.filter((i) => i.checklist_id === c.id).map((i) => ({ id: i.id as string, text: i.text as string, done: !!i.done })) })),
    subtasks: (subs.data ?? []) as TaskDetail['subtasks'],
    comments: (com.data ?? []) as TaskDetail['comments'],
    attachments: (att.data ?? []).map((a) => ({ id: a.id, kind: a.kind, name: a.name, url: a.url, link_type: a.link_type, mime_type: a.mime_type, size_bytes: a.size_bytes, created_at: a.created_at, signed: a.storage_path ? (signed[a.storage_path] ?? null) : null })),
    activity: (act.data ?? []) as TaskDetail['activity'],
    links: {
      content: (content.data as TaskDetail['links']['content']) ?? null,
      identity: (identity.data as TaskDetail['links']['identity']) ?? null,
      report: (report.data as TaskDetail['links']['report']) ?? null,
      campaign: (campaign.data as TaskDetail['links']['campaign']) ?? null,
      client: client.data ? { id: (client.data as { id: string }).id, name: (client.data as { company_name: string }).company_name } : null,
    },
  };
}

// ─── atividade ──────────────────────────────────────────────────────
export async function logProd(db: SupabaseClient, e: { boardId: string; taskId?: string | null; actor?: string; action: string; detail?: string }) {
  await db.from('prod_activity').insert({ board_id: e.boardId, task_id: e.taskId ?? null, actor_name: e.actor ?? 'Soltria', action: e.action, detail: e.detail ?? '' });
}

// ─── sincronização com o módulo de conteúdo ─────────────────────────
const endPosition = async (db: SupabaseClient, columnId: string) => {
  const { data } = await db.from('prod_tasks').select('position').eq('column_id', columnId).order('position', { ascending: false }).limit(1);
  return ((data?.[0]?.position as number | undefined) ?? 0) + 1000;
};

/**
 * Move os cards ligados a um conteúdo para a coluna correspondente ao novo status
 * (só nos quadros com "Sincronizar status automaticamente" ligado). Nunca lança erro:
 * se as tabelas ainda não existem ou algo falha, o fluxo de conteúdo segue normal.
 */
export async function syncTasksForContent(db: SupabaseClient, contentId: string, kind: ColumnKind): Promise<void> {
  try {
    const { data: tasks, error } = await db.from('prod_tasks').select('id, board_id, column_id, title').eq('content_id', contentId).eq('archived', false);
    if (error || !tasks?.length) return;
    const boardIds = [...new Set(tasks.map((t) => t.board_id as string))];
    const { data: boards } = await db.from('prod_boards').select('id, settings, archived').in('id', boardIds);
    for (const b of boards ?? []) {
      if (b.archived || !(b.settings as { sync_status?: boolean })?.sync_status) continue;
      const { data: col } = await db.from('prod_columns').select('id, name, kind').eq('board_id', b.id).eq('kind', kind).order('position').limit(1).maybeSingle();
      if (!col) continue;
      for (const t of tasks.filter((x) => x.board_id === b.id && x.column_id !== col.id)) {
        const done = DONE_KINDS.includes(col.kind as ColumnKind);
        await db.from('prod_tasks').update({ column_id: col.id, position: await endPosition(db, col.id as string), completed_at: done ? new Date().toISOString() : null }).eq('id', t.id);
        await logProd(db, { boardId: b.id as string, taskId: t.id as string, actor: 'Sistema', action: 'sync', detail: `Movido automaticamente para "${col.name}" (status do conteúdo)` });
      }
    }
  } catch {
    /* sincronização é opcional */
  }
}

/** Cria um card automaticamente quando um conteúdo novo é criado (quadros com a opção ligada). */
export async function autoCreateTaskForContent(db: SupabaseClient, content: { id: string; client_id: string; title: string; format: string; scheduled_date: string | null }): Promise<void> {
  try {
    const { data: client } = await db.from('clients').select('owner_id').eq('id', content.client_id).maybeSingle();
    if (!client) return;
    const { data: boards, error } = await db.from('prod_boards').select('id, settings').eq('owner_id', client.owner_id).eq('archived', false);
    if (error) return;
    const FORMAT_LABEL: Record<string, string> = { post: 'Post', carousel: 'Carrossel', reel: 'Reel', story: 'Story', video: 'Vídeo' };
    for (const b of boards ?? []) {
      const s = (b.settings ?? {}) as { auto_create?: boolean; auto_create_column_id?: string | null };
      if (!s.auto_create) continue;
      const { data: existing } = await db.from('prod_tasks').select('id').eq('board_id', b.id).eq('content_id', content.id).limit(1);
      if (existing?.length) continue;
      let colId = s.auto_create_column_id ?? null;
      if (!colId) colId = ((await db.from('prod_columns').select('id').eq('board_id', b.id).order('position').limit(1)).data?.[0]?.id as string | undefined) ?? null;
      if (!colId) continue;
      const category = FORMAT_TO_CATEGORY[content.format] ?? 'other';
      const { data: task } = await db.from('prod_tasks').insert({ board_id: b.id, column_id: colId, position: await endPosition(db, colId), title: `${FORMAT_LABEL[content.format] ?? 'Conteúdo'} — ${content.title}`, client_id: content.client_id, content_id: content.id, due_date: content.scheduled_date, category, source: 'auto' }).select('id').single();
      if (!task) continue;
      const tpl = CHECKLIST_TEMPLATE_BY_ID[category];
      if (tpl) {
        const { data: cl } = await db.from('prod_checklists').insert({ task_id: task.id, title: tpl.title }).select('id').single();
        if (cl) await db.from('prod_checklist_items').insert(tpl.items.map((text, i) => ({ checklist_id: cl.id, text, position: i })));
      }
      await logProd(db, { boardId: b.id as string, taskId: task.id as string, actor: 'Sistema', action: 'created', detail: 'Card criado automaticamente a partir do novo conteúdo' });
    }
  } catch {
    /* opcional */
  }
}

// ─── tarefas recorrentes ────────────────────────────────────────────
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function nextRun(r: { cadence: string; weekday: number | null; month_day: number | null; every_days: number | null }, from: string): string {
  if (r.cadence === 'daily') return addDays(from, 1);
  if (r.cadence === 'weekly') return addDays(from, 7);
  if (r.cadence === 'custom') return addDays(from, Math.max(1, r.every_days ?? 7));
  const [y, m] = from.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const d = Math.min(r.month_day ?? 1, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Cria as tarefas recorrentes que já venceram (idempotente: avança `next_run` ao criar). */
export async function runRecurrences(db: SupabaseClient, boardId: string): Promise<number> {
  const today = todayBR();
  const { data: recs, error } = await db.from('prod_recurrences').select('*').eq('board_id', boardId).eq('active', true).lte('next_run', today);
  if (error || !recs?.length) return 0;
  let created = 0;
  for (const r of recs) {
    // passa pelas datas atrasadas sem criar uma tarefa para cada uma: cria uma só e salta para a próxima data futura
    let next = nextRun(r, r.next_run as string);
    let guard = 0;
    while (next <= today && guard++ < 400) next = nextRun(r, next);
    const { data: claimed } = await db.from('prod_recurrences').update({ next_run: next }).eq('id', r.id).eq('next_run', r.next_run).select('id');
    if (!claimed?.length) continue; // outra aba já criou
    const { data: task } = await db
      .from('prod_tasks')
      .insert({ board_id: boardId, column_id: r.column_id, position: await endPosition(db, r.column_id as string), title: r.title, description: r.description, client_id: r.client_id, category: r.category, priority: r.priority, due_date: addDays(today, (r.due_offset as number) ?? 0), source: 'recurring' })
      .select('id')
      .single();
    if (task) {
      created++;
      await logProd(db, { boardId, taskId: task.id as string, actor: 'Sistema', action: 'created', detail: 'Tarefa recorrente criada' });
    }
  }
  return created;
}

export const DEFAULT_COLUMN_ROWS = DEFAULT_COLUMNS;
