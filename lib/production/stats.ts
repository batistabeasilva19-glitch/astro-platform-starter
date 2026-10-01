import { todayBR } from '@/lib/perf/calc';
import { CATEGORY_BY_ID, DONE_KINDS, type ClientLite, type ColumnRow, type TaskLite } from './types';

/** Indicadores de produção (puros): usados no dashboard, na página da produção, nas métricas e na página do cliente. */
export interface ProductionStats {
  open: number;
  production: number;
  awaiting: number;
  changes: number;
  overdue: number;
  today: number;
  urgentToday: number;
  doneMonth: number;
}

export function productionStats(tasks: TaskLite[], columns: ColumnRow[], today = todayBR()): ProductionStats {
  const kind = new Map(columns.map((c) => [c.id, c.kind]));
  const monthStart = `${today.slice(0, 7)}-01`;
  const s: ProductionStats = { open: 0, production: 0, awaiting: 0, changes: 0, overdue: 0, today: 0, urgentToday: 0, doneMonth: 0 };
  for (const t of tasks) {
    const k = kind.get(t.column_id) ?? 'custom';
    const done = DONE_KINDS.includes(k);
    if (done) {
      if (t.completed_at && t.completed_at.slice(0, 10) >= monthStart) s.doneMonth++;
      continue;
    }
    s.open++;
    if (k === 'production') s.production++;
    if (k === 'awaiting_client') s.awaiting++;
    if (k === 'changes') s.changes++;
    if (t.due_date && t.due_date < today) s.overdue++;
    if (t.due_date === today) {
      s.today++;
      if (t.priority === 'urgent') s.urgentToday++;
    }
  }
  return s;
}

export interface ProductionMetrics {
  doneMonth: number;
  overdue: number;
  /** tempo médio entre criar e concluir (dias), só tarefas concluídas */
  avgDays: number | null;
  byClient: { label: string; value: number }[];
  byCategory: { label: string; value: number }[];
}
export function productionMetrics(tasks: TaskLite[], columns: ColumnRow[], clients: ClientLite[], today = todayBR()): ProductionMetrics {
  const st = productionStats(tasks, columns, today);
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const kind = new Map(columns.map((c) => [c.id, c.kind]));
  const open = tasks.filter((t) => !DONE_KINDS.includes(kind.get(t.column_id) ?? 'custom'));
  const durations = tasks.filter((t) => t.completed_at).map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 86400000);
  const count = (key: (t: TaskLite) => string) => {
    const m = new Map<string, number>();
    for (const t of open) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  return {
    doneMonth: st.doneMonth,
    overdue: st.overdue,
    avgDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    byClient: count((t) => (t.client_id ? (names.get(t.client_id) ?? 'Cliente') : 'Sem cliente')).slice(0, 12),
    byCategory: count((t) => CATEGORY_BY_ID[t.category]?.label ?? 'Outro'),
  };
}
