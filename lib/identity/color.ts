import type { ColorItem, Palette, StageContent, FontItem, FontRole } from './types';
import { newId } from './types';

const clean = (hex: string) => hex.replace('#', '');
export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(clean(isHex(hex) ? hex : '#000000'), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** CMYK aproximado (conversão simples, sem perfil de cor). */
export function hexToCmyk(hex: string): [number, number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return [c, m, y, k].map((v) => Math.round(v * 100)) as [number, number, number, number];
}

export const rgbText = (hex: string) => hexToRgb(hex).join(' ');
/** valor manual, se houver; senão o aproximado */
export const cmykText = (c: Pick<ColorItem, 'hex' | 'cmyk'>) => (c.cmyk?.trim() ? c.cmyk.trim() : hexToCmyk(c.hex).join(' '));

const lum = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** Orientação visual baseada em WCAG (AAA ≥ 7, AA ≥ 4.5). Não é certificação. */
export function contrastLevel(ratio: number): { label: 'Contraste alto' | 'Contraste médio' | 'Contraste baixo'; tone: 'high' | 'mid' | 'low' } {
  if (ratio >= 7) return { label: 'Contraste alto', tone: 'high' };
  if (ratio >= 4.5) return { label: 'Contraste médio', tone: 'mid' };
  return { label: 'Contraste baixo', tone: 'low' };
}
export const isDarkColor = (hex: string) => lum(hex) < 0.3;

// ─── normalização do conteúdo (compatível com o formato antigo) ─────────────
export function getPalettes(content: StageContent): Palette[] {
  if (content.palettes?.length) {
    return content.palettes.map((p) => ({ ...p, description: p.description ?? '', colors: p.colors.map((c) => ({ ...c, cmyk: c.cmyk ?? '', pantone: c.pantone ?? '' })) }));
  }
  if (content.colors?.length) {
    return [{ id: 'legacy', label: 'Paleta 01', description: '', colors: content.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, cmyk: '', pantone: '' })) }];
  }
  return [];
}

export function getFonts(content: StageContent): FontItem[] {
  return (content.fonts ?? []).map((f, i) => {
    const raw = f as Partial<FontItem> & { role?: string; note?: string };
    const role: FontRole = raw.role === 'main' || raw.role === 'secondary' || raw.role === 'support' ? raw.role : i === 0 ? 'main' : i === 1 ? 'secondary' : 'support';
    return { id: raw.id ?? newId(), role, name: raw.name ?? '', category: raw.category ?? '', reference: raw.reference ?? '', usage: raw.usage ?? raw.note ?? '', sample: raw.sample ?? '' };
  });
}

export const allColors = (content: StageContent) => getPalettes(content).flatMap((p) => p.colors);
