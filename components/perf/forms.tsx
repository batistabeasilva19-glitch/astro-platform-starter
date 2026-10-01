'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { SOURCES, type MetricDef } from '@/lib/perf/types';

/** Campo numérico: aceita só números (inteiros ou com vírgula), vazio = "não informado". */
export function NumberField({ def, value, onChange }: { def: MetricDef; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={def.label} hint={def.hint}>
      <Input inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="–" />
    </Field>
  );
}

export function MetricGroup({ title, defs, values, onChange }: { title?: string; defs: MetricDef[]; values: Record<string, string>; onChange: (key: string, v: string) => void }) {
  return (
    <fieldset>
      {title && <legend className="label mb-3 text-wine">{title}</legend>}
      <div className="grid gap-4 sm:grid-cols-2">
        {defs.map((d) => (
          <NumberField key={d.key} def={d} value={values[d.key] ?? ''} onChange={(v) => onChange(d.key, v)} />
        ))}
      </div>
    </fieldset>
  );
}

/** Origem dos dados (Instagram Insights, Meta Ads…) + observação da fonte. */
export function SourceFields({ source, note, onSource, onNote, hideNote }: { source: string; note: string; onSource: (v: string) => void; onNote: (v: string) => void; hideNote?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Origem dos dados">
        <Select value={source} onChange={(e) => onSource(e.target.value)}>
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </Field>
      {!hideNote && (
        <Field label="Observação da fonte">
          <Input value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ex.: exportado em 02/10, aba Visão geral" maxLength={300} />
        </Field>
      )}
    </div>
  );
}

export const NotesField = ({ value, onChange, label = 'Observações' }: { value: string; onChange: (v: string) => void; label?: string }) => (
  <Field label={label}>
    <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} maxLength={2000} />
  </Field>
);

export const toStrings = (rec: Record<string, number | null | undefined> | undefined): Record<string, string> => Object.fromEntries(Object.entries(rec ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v).replace('.', ',')]));

/** Cada métrica com dois campos lado a lado: "Antes" (base de comparação) e "Depois" (o período que está sendo cadastrado). */
export function BeforeAfterGroup({ title, defs, before, after, onBefore, onAfter }: { title: string; defs: MetricDef[]; before: Record<string, string>; after: Record<string, string>; onBefore: (key: string, v: string) => void; onAfter: (key: string, v: string) => void }) {
  const clean = (v: string) => v.replace(/[^\d.,]/g, '');
  return (
    <fieldset>
      <legend className="label mb-3 text-wine">{title}</legend>
      <div className="space-y-4">
        {defs.map((d) => (
          <div key={d.key}>
            <p className="label mb-2 text-wine">{d.label}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-ink/50">Antes</span>
                <Input inputMode="decimal" autoComplete="off" aria-label={`${d.label} — antes`} value={before[d.key] ?? ''} onChange={(e) => onBefore(d.key, clean(e.target.value))} placeholder="–" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink/50">Depois</span>
                <Input inputMode="decimal" autoComplete="off" aria-label={`${d.label} — depois`} value={after[d.key] ?? ''} onChange={(e) => onAfter(d.key, clean(e.target.value))} placeholder="–" />
              </label>
            </div>
            {d.hint && <p className="mt-1.5 text-xs text-ink/50">{d.hint}</p>}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
