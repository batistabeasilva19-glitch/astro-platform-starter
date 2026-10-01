/** Portal do cliente: roteiros, calendário do mês e stories — tipos e utilidades (servidor e navegador). */
export const PLAN_FORMATS = [
  { id: 'post', label: 'Post' },
  { id: 'carousel', label: 'Carrossel' },
  { id: 'reel', label: 'Reel' },
  { id: 'story', label: 'Story' },
  { id: 'video', label: 'Vídeo' },
] as const;
export type PlanFormat = (typeof PLAN_FORMATS)[number]['id'];
export const FORMAT_LABEL: Record<string, string> = Object.fromEntries(PLAN_FORMATS.map((f) => [f.id, f.label]));

export interface ScriptRow {
  id: string;
  client_id: string;
  month: string;
  position: number;
  title: string;
  script: string;
  notes: string;
  shoot_date: string | null;
  visible: boolean;
}
export type PlanStatus = 'draft' | 'awaiting' | 'approved' | 'changes_requested';
export type ItemStatus = 'pending' | 'approved' | 'changes_requested';
export interface PlanRow {
  id: string;
  client_id: string;
  month: string;
  note: string;
  status: PlanStatus;
  visible: boolean;
  sent_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}
export interface PlanItemRow {
  id: string;
  plan_id: string;
  position: number;
  format: PlanFormat;
  title: string;
  publish_date: string | null;
  description: string;
  content_id: string | null;
  /** link da arte (Drive, Canva, Figma…) */
  link: string;
  client_status: ItemStatus;
  client_note: string;
  decided_at: string | null;
}
export interface StoryRow {
  id: string;
  client_id: string;
  story_date: string;
  position: number;
  title: string;
  description: string;
  link: string;
  content_id: string | null;
  visible: boolean;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, { admin: string; client: string }> = {
  draft: { admin: 'Rascunho (cliente não vê)', client: 'Em preparo' },
  awaiting: { admin: 'Aguardando aprovação', client: 'Aguardando sua aprovação' },
  approved: { admin: 'Aprovado', client: 'Aprovado ♡' },
  changes_requested: { admin: 'Alteração solicitada', client: 'Alteração solicitada' },
};
export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = { pending: 'Aguardando', approved: 'Aprovado', changes_requested: 'Alteração pedida' };

export const monthKey = (d: string) => d.slice(0, 7);
export function monthTitle(d: string): string {
  const [y, m] = d.slice(0, 7).split('-').map(Number);
  const t = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1, 12)));
  return t.charAt(0).toUpperCase() + t.slice(1).replace(' de ', ' · ');
}
export function dayTitle(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day, 12)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// ─── Agenda: gravações e reuniões de alinhamento ─────────────────────
export const EVENT_KINDS = [
  { id: 'recording', label: 'Gravação' },
  { id: 'meeting', label: 'Reunião de alinhamento' },
] as const;
export type EventKind = (typeof EVENT_KINDS)[number]['id'];
export type EventStatus = 'scheduled' | 'done' | 'cancelled';
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = { scheduled: 'Agendado', done: 'Realizado', cancelled: 'Cancelado' };
export interface EventRow {
  id: string;
  client_id: string;
  kind: EventKind;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  link: string;
  notes: string;
  status: EventStatus;
  visible: boolean;
}
export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
/** Link "Adicionar ao Google Agenda" (abre o evento já preenchido). */
export function googleCalendarUrl(e: Pick<EventRow, 'title' | 'event_date' | 'start_time' | 'end_time' | 'location' | 'link' | 'notes'>): string {
  const d = e.event_date.replace(/-/g, '');
  const fmt = (t: string) => `${d}T${t.slice(0, 2)}${t.slice(3, 5)}00`;
  const dates = e.start_time ? `${fmt(e.start_time)}/${fmt(e.end_time || e.start_time)}` : `${d}/${d}`;
  const details = [e.notes, e.link && `Link: ${e.link}`].filter(Boolean).join('\n');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details, location: e.location });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
