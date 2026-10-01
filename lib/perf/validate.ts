/** Validação dos números digitados: mensagens claras, sem aceitar valores impossíveis. */
import type { MetricDef } from './types';

export type Parsed = { ok: true; values: Record<string, number> } | { ok: false; error: string };

const toNumber = (raw: unknown): number | null | 'invalid' => {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 'invalid';
  const t = String(raw).trim();
  if (!t) return null;
  // aceita 1.234,56 e 1234.56
  const norm = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t;
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return 'invalid';
  return Number(norm);
};

/** Converte e valida um conjunto de campos numéricos. Campos vazios ficam de fora (= não informado). */
export function parseMetrics(input: Record<string, unknown>, defs: MetricDef[], opts: { decimals?: Set<string> } = {}): Parsed {
  const values: Record<string, number> = {};
  for (const d of defs) {
    const n = toNumber(input[d.key]);
    if (n === null) continue;
    if (n === 'invalid') return { ok: false, error: `“${d.label}”: digite apenas números.` };
    if (n < 0) return { ok: false, error: `“${d.label}” não pode ser negativo.` };
    if (d.unit === 'pct' && n > 100) return { ok: false, error: `“${d.label}” precisa estar entre 0 e 100.` };
    const decimals = opts.decimals?.has(d.key) ?? d.unit !== 'int';
    if (!decimals && !Number.isInteger(n)) return { ok: false, error: `“${d.label}” precisa ser um número inteiro.` };
    if (n > 1e12) return { ok: false, error: `“${d.label}” está grande demais.` };
    values[d.key] = n;
  }
  return { ok: true, values };
}

export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
