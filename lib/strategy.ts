/** Estratégia de rede: tipos e utilidades de mês (compartilhado entre servidor e navegador). */
export interface StrategyDoc {
  id: string;
  client_id: string;
  month: string; // 'YYYY-MM-01'
  title: string;
  description: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

/** Versão sem caminho do Storage — é o que o portal do cliente recebe. */
export type PublicStrategyDoc = Omit<StrategyDoc, 'storage_path' | 'client_id'>;

export const monthKey = (d: string) => d.slice(0, 7); // 'YYYY-MM'
export const toMonthDate = (ym: string) => `${ym}-01`;
export const currentMonth = () => new Date().toISOString().slice(0, 7);

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const text = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1, 12)));
  return text.charAt(0).toUpperCase() + text.slice(1).replace(' de ', ' · ');
}

export function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Agrupa por mês (mais recente primeiro). */
export function groupByMonth<T extends { month: string; created_at: string }>(docs: T[]): { month: string; docs: T[] }[] {
  const map = new Map<string, T[]>();
  for (const d of docs) {
    const k = monthKey(d.month);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, list]) => ({ month, docs: list.sort((x, y) => y.created_at.localeCompare(x.created_at)) }));
}
