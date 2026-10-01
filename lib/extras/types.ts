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
