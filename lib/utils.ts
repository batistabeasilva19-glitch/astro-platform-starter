import { clsx, type ClassValue } from 'clsx';

export const cn = (...v: ClassValue[]) => clsx(v);

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const TZ = 'America/Sao_Paulo';

/** 'YYYY-MM-DD' → Date local (sem deslocamento de fuso). */
export function parseDateOnly(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → '28/09' (ou '28/09/2026' com ano). */
export function fmtDate(d: string | null, withYear = false): string {
  if (!d) return 'Sem data';
  const [y, m, day] = d.split('-');
  return withYear ? `${day}/${m}/${y}` : `${day}/${m}`;
}

export function fmtDateLong(d: string | null): string {
  if (!d) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseDateOnly(d));
}

export const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '');

/** Timestamp ISO → '30/09 às 14:32' (fuso de São Paulo). */
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);
  return `${date} às ${time}`;
}

export function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(new Date(iso));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const cleanHandle = (h: string) => h.trim().replace(/^@+/, '');

export function fmtDuration(sec: number | null): string {
  if (!sec && sec !== 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function pluralize(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
