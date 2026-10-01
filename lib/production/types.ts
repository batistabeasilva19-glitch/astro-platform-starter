import { Briefcase, CalendarClock, CircleDashed, ClipboardList, Clapperboard, FileBarChart, GalleryHorizontal, Image as ImageIcon, MessageSquareWarning, Palette, Users, Video, type LucideIcon } from 'lucide-react';
import { addDays, todayBR } from '@/lib/perf/calc';

/** PRODUÇÃO (Kanban interno): constantes, modelos e regras compartilhadas. */

export const PRIORITIES = [
  { id: 'low', label: 'Baixa', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 ring-sky-200', weight: 1 },
  { id: 'medium', label: 'Média', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 ring-amber-200', weight: 2 },
  { id: 'high', label: 'Alta', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-800 ring-orange-200', weight: 3 },
  { id: 'urgent', label: 'Urgente', dot: 'bg-red-600', chip: 'bg-red-50 text-red-700 ring-red-200', weight: 4 },
] as const;
export type Priority = (typeof PRIORITIES)[number]['id'];
export const PRIORITY_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p])) as Record<Priority, (typeof PRIORITIES)[number]>;

export const CATEGORIES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'post', label: 'Post', icon: ImageIcon },
  { id: 'carousel', label: 'Carrossel', icon: GalleryHorizontal },
  { id: 'reel', label: 'Reel', icon: Clapperboard },
  { id: 'story', label: 'Story', icon: CircleDashed },
  { id: 'video', label: 'Vídeo', icon: Video },
  { id: 'identity', label: 'Identidade Visual', icon: Palette },
  { id: 'report', label: 'Relatório', icon: FileBarChart },
  { id: 'meeting', label: 'Reunião', icon: CalendarClock },
  { id: 'client', label: 'Cliente', icon: Users },
  { id: 'admin', label: 'Administrativo', icon: Briefcase },
  { id: 'change', label: 'Alteração', icon: MessageSquareWarning },
  { id: 'other', label: 'Outro', icon: ClipboardList },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, (typeof CATEGORIES)[number]>;
export const FORMAT_TO_CATEGORY: Record<string, string> = { post: 'post', carousel: 'carousel', reel: 'reel', story: 'story', video: 'video' };

export const COLUMN_KINDS = [
  { id: 'idea', label: 'Ideias' },
  { id: 'todo', label: 'A fazer' },
  { id: 'production', label: 'Em produção' },
  { id: 'review', label: 'Em revisão' },
  { id: 'awaiting_client', label: 'Aguardando cliente' },
  { id: 'changes', label: 'Alteração solicitada' },
  { id: 'approved', label: 'Aprovado' },
  { id: 'scheduled', label: 'Agendado' },
  { id: 'published', label: 'Publicado' },
  { id: 'done', label: 'Concluído' },
  { id: 'custom', label: 'Sem papel especial' },
] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number]['id'];
export const DONE_KINDS: ColumnKind[] = ['published', 'done'];
/** Colunas que o sistema consegue alimentar automaticamente a partir do status do conteúdo. */
export const SYNC_KINDS: ColumnKind[] = ['awaiting_client', 'changes', 'approved', 'scheduled', 'published'];

/** Modelo de produção: cria estas colunas automaticamente. */
export const DEFAULT_COLUMNS: { name: string; kind: ColumnKind }[] = [
  { name: 'Ideias', kind: 'idea' },
  { name: 'A fazer', kind: 'todo' },
  { name: 'Em produção', kind: 'production' },
  { name: 'Em revisão', kind: 'review' },
  { name: 'Aguardando cliente', kind: 'awaiting_client' },
  { name: 'Alteração solicitada', kind: 'changes' },
  { name: 'Aprovado', kind: 'approved' },
  { name: 'Agendado', kind: 'scheduled' },
  { name: 'Publicado', kind: 'published' },
  { name: 'Concluído', kind: 'done' },
];
export const BOARD_TEMPLATES = [
  { id: 'producao', label: 'Modelo de produção', hint: '10 colunas: Ideias → A fazer → Em produção → Em revisão → Aguardando cliente → … → Concluído', columns: DEFAULT_COLUMNS },
  { id: 'simples', label: 'Quadro simples', hint: 'A fazer · Em andamento · Concluído', columns: [{ name: 'A fazer', kind: 'todo' }, { name: 'Em andamento', kind: 'production' }, { name: 'Concluído', kind: 'done' }] as { name: string; kind: ColumnKind }[] },
  { id: 'vazio', label: 'Em branco', hint: 'Uma coluna "A fazer" — você monta o resto', columns: [{ name: 'A fazer', kind: 'todo' }] as { name: string; kind: ColumnKind }[] },
] as const;

export interface BoardSettings {
  /** mover cards automaticamente quando o status do conteúdo vinculado mudar */
  sync_status?: boolean;
  /** criar um card automaticamente quando um novo conteúdo for criado */
  auto_create?: boolean;
  auto_create_column_id?: string | null;
  /** esconder cards concluídos por padrão */
  hide_done?: boolean;
  /** só permitir mover para "Concluído/Publicado" com checklist 100% */
  require_checklist_for_done?: boolean;
}

// ─── modelos de checklist e de card ─────────────────────────────────
export const CHECKLIST_TEMPLATES: { id: string; title: string; items: string[] }[] = [
  { id: 'post', title: 'Post', items: ['Briefing', 'Copy', 'Design', 'Revisão', 'Cliente', 'Agendamento', 'Publicação'] },
  { id: 'carousel', title: 'Carrossel', items: ['Definir pauta', 'Criar copy', 'Criar design', 'Revisar', 'Enviar cliente', 'Agendar'] },
  { id: 'reel', title: 'Reel', items: ['Roteiro', 'Gravação', 'Edição', 'Legenda', 'Capa', 'Revisão', 'Cliente', 'Agendamento', 'Publicação'] },
  { id: 'identity', title: 'Identidade Visual', items: ['Briefing', 'Pesquisa', 'Moodboard', 'Logo', 'Paleta', 'Tipografia', 'Aplicações', 'Apresentação', 'Aprovação', 'Arquivos finais'] },
  { id: 'report', title: 'Relatório mensal', items: ['Cadastrar métricas do perfil', 'Cadastrar desempenho dos conteúdos', 'Gerar relatório do mês', 'Revisar e escrever análise', 'Finalizar e exportar PDF', 'Disponibilizar ao cliente'] },
  { id: 'onboarding', title: 'Onboarding de cliente', items: ['Reunião de alinhamento', 'Enviar formulário da marca', 'Acesso às redes sociais', 'Print do perfil (antes)', 'Cadastrar cliente na plataforma', 'Planejar primeiro mês'] },
];
export const CHECKLIST_TEMPLATE_BY_ID = Object.fromEntries(CHECKLIST_TEMPLATES.map((t) => [t.id, t]));

export const TASK_TEMPLATES: { id: string; label: string; title: string; category: string; priority: Priority; checklist: string; subtasks?: string[] }[] = [
  { id: 'reel', label: 'Novo Reel', title: 'Novo Reel', category: 'reel', priority: 'medium', checklist: 'reel' },
  { id: 'carousel', label: 'Novo Carrossel', title: 'Novo Carrossel', category: 'carousel', priority: 'medium', checklist: 'carousel', subtasks: ['Pesquisar referências', 'Escrever slides', 'Criar arte', 'Revisar', 'Enviar'] },
  { id: 'identity', label: 'Nova Identidade Visual', title: 'Nova Identidade Visual', category: 'identity', priority: 'high', checklist: 'identity' },
  { id: 'report', label: 'Relatório Mensal', title: 'Relatório mensal', category: 'report', priority: 'medium', checklist: 'report' },
  { id: 'onboarding', label: 'Onboarding Cliente', title: 'Onboarding de cliente', category: 'client', priority: 'high', checklist: 'onboarding' },
];

export const LINK_TYPES = [
  { id: 'drive', label: 'Google Drive' },
  { id: 'canva', label: 'Canva' },
  { id: 'figma', label: 'Figma' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'site', label: 'Site' },
  { id: 'other', label: 'Outro' },
] as const;
export const guessLinkType = (url: string): string => {
  const u = url.toLowerCase();
  if (u.includes('drive.google') || u.includes('docs.google')) return 'drive';
  if (u.includes('canva.')) return 'canva';
  if (u.includes('figma.')) return 'figma';
  if (u.includes('instagram.')) return 'instagram';
  return /^https?:\/\//.test(u) ? 'site' : 'other';
};

// ─── dados exibidos ─────────────────────────────────────────────────
export interface BoardRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  client_id: string | null;
  favorite: boolean;
  archived: boolean;
  settings: BoardSettings;
  created_at: string;
  updated_at: string;
}
export interface ColumnRow {
  id: string;
  board_id: string;
  name: string;
  position: number;
  kind: ColumnKind;
}
export interface MemberRow {
  id: string;
  name: string;
  role: string;
  color: string;
  user_id: string | null;
}
export interface TagRow {
  id: string;
  name: string;
  color: string;
}
export interface TaskLite {
  id: string;
  board_id: string;
  column_id: string;
  position: number;
  title: string;
  /** início da descrição (só para busca) */
  description: string;
  client_id: string | null;
  category: string;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  due_time: string | null;
  archived: boolean;
  completed_at: string | null;
  content_id: string | null;
  source: string;
  created_at: string;
  tag_ids: string[];
  assignee_ids: string[];
  checklist: { done: number; total: number };
  subtasks: { done: number; total: number };
  comments: number;
  attachments: number;
}
export interface ClientLite {
  id: string;
  name: string;
}

// ─── prazos ─────────────────────────────────────────────────────────
export type DueState = 'overdue' | 'today' | 'tomorrow' | 'soon' | null;
export function dueState(due: string | null, done: boolean, today = todayBR()): { state: DueState; label: string } {
  if (!due || done) return { state: null, label: '' };
  if (due < today) return { state: 'overdue', label: 'ATRASADO' };
  if (due === today) return { state: 'today', label: 'HOJE' };
  if (due === addDays(today, 1)) return { state: 'tomorrow', label: 'AMANHÃ' };
  const n = Math.round((new Date(`${due}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
  if (n <= 3) return { state: 'soon', label: `${n} dias restantes` };
  return { state: null, label: '' };
}
export const DUE_CHIP: Record<Exclude<DueState, null>, string> = {
  overdue: 'bg-red-600 text-white',
  today: 'bg-orange-500 text-white',
  tomorrow: 'bg-amber-100 text-amber-900',
  soon: 'bg-blush text-wine',
};

export const TAG_COLORS = ['#771430', '#b8860b', '#2e7d5b', '#2f6db5', '#7a4bb0', '#c0392b', '#d97706', '#475569'];
export const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

/** Posição entre dois vizinhos (indexação fracionária): arrastar não precisa renumerar a coluna inteira. */
export const positionBetween = (before: number | null, after: number | null) => (before == null && after == null ? 1000 : before == null ? after! - 1000 : after == null ? before + 1000 : (before + after) / 2);

// ─── filtros ────────────────────────────────────────────────────────
export interface TaskFilters {
  q: string;
  client: string;
  assignee: string;
  category: string;
  priority: string;
  tag: string;
  column: string;
  board: string;
  quick: '' | 'overdue' | 'today' | 'week' | 'unassigned';
  hideDone: boolean;
}
export const EMPTY_FILTERS: TaskFilters = { q: '', client: '', assignee: '', category: '', priority: '', tag: '', column: '', board: '', quick: '', hideDone: false };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filterTasks(tasks: TaskLite[], f: TaskFilters, ctx: { clients: ClientLite[]; tags: TagRow[]; doneColumnIds: Set<string>; today?: string }): TaskLite[] {
  const today = ctx.today ?? todayBR();
  const weekEnd = addDays(today, 6 - new Date(`${today}T00:00:00Z`).getUTCDay());
  const q = norm(f.q.trim());
  const clientName = new Map(ctx.clients.map((c) => [c.id, norm(c.name)]));
  const tagName = new Map(ctx.tags.map((t) => [t.id, norm(t.name)]));
  return tasks.filter((t) => {
    if (f.client && t.client_id !== f.client) return false;
    if (f.assignee === 'none' ? t.assignee_ids.length > 0 : f.assignee && !t.assignee_ids.includes(f.assignee)) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.tag && !t.tag_ids.includes(f.tag)) return false;
    if (f.column && t.column_id !== f.column) return false;
    if (f.board && t.board_id !== f.board) return false;
    const done = ctx.doneColumnIds.has(t.column_id);
    if (f.hideDone && done) return false;
    if (f.quick === 'overdue' && !(t.due_date && t.due_date < today && !done)) return false;
    if (f.quick === 'today' && t.due_date !== today) return false;
    if (f.quick === 'week' && !(t.due_date && t.due_date >= today && t.due_date <= weekEnd)) return false;
    if (f.quick === 'unassigned' && t.assignee_ids.length) return false;
    if (q) {
      const hay = [t.title, t.description, t.client_id ? clientName.get(t.client_id) : '', ...t.tag_ids.map((id) => tagName.get(id) ?? '')].map((x) => norm(x ?? '')).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
