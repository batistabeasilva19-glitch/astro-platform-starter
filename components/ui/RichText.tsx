'use client';

import { useState, type ChangeEvent, type ReactNode } from 'react';
import { RichEditor } from '@/components/ui/RichEditor';
import { cn } from '@/lib/utils';

/*
 * Texto com formatação leve, guardado como texto puro (nenhuma migration):
 *   **negrito**  _itálico_  ++sublinhado++  ~~riscado~~  `código`  [texto](https://link)
 *   "- " lista · "1. " lista numerada · "> " citação
 * O texto copiado continua sendo o mesmo texto; só a exibição (RichText) aplica o visual.
 */

type Inline = { re: RegExp; wrap: (children: ReactNode, m: RegExpExecArray, key: string) => ReactNode };

const INLINE: Inline[] = [
  { re: /`([^`\n]+)`/, wrap: (c, _m, k) => <code key={k} className="rounded bg-wine/10 px-1 py-0.5 font-mono text-[0.9em]">{c}</code> },
  { re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/, wrap: (c, m, k) => <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-wine underline underline-offset-2">{c}</a> },
  { re: /\*\*([^*\n]+)\*\*/, wrap: (c, _m, k) => <strong key={k} className="font-semibold">{c}</strong> },
  { re: /\+\+([^+\n]+)\+\+/, wrap: (c, _m, k) => <u key={k}>{c}</u> },
  { re: /~~([^~\n]+)~~/, wrap: (c, _m, k) => <s key={k}>{c}</s> },
  { re: /(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/, wrap: (c, _m, k) => <em key={k}>{c}</em> },
];

function inline(text: string, keyPrefix = 'i'): ReactNode[] {
  let best: { idx: number; m: RegExpExecArray; def: Inline } | null = null;
  for (const def of INLINE) {
    const m = def.re.exec(text);
    if (m && (!best || m.index < best.idx)) best = { idx: m.index, m, def };
  }
  if (!best) return [text];
  const { m, def } = best;
  // o itálico captura 1 caractere antes do "_": preserva esse caractere
  const lead = def.re.source.startsWith('(^|') ? m[1] : '';
  const inner = def.re.source.startsWith('(^|') ? m[2] : m[1];
  const before = text.slice(0, m.index) + lead;
  const after = text.slice(m.index + m[0].length);
  return [before, def.wrap(inline(inner, `${keyPrefix}c`), m, `${keyPrefix}-${m.index}`), ...inline(after, `${keyPrefix}a`)];
}

/** Exibe o texto formatado (seguro: nunca injeta HTML). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*- /.test(line) || /^\s*\d+\. /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      const re = ordered ? /^\s*\d+\. (.*)$/ : /^\s*- (.*)$/;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(re.exec(lines[i])![1]);
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={`l${i}`} className={cn('my-1 space-y-0.5 pl-5', ordered ? 'list-decimal' : 'list-disc')}>
          {items.map((t, k) => <li key={k}>{inline(t)}</li>)}
        </Tag>,
      );
    } else if (/^>\s?/.test(line)) {
      const qs: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qs.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote key={`q${i}`} className="my-1 border-l-2 border-wine/40 pl-3 italic text-ink/75">
          {qs.map((t, k) => <span key={k} className="block">{inline(t)}</span>)}
        </blockquote>,
      );
    } else {
      // linhas comuns seguidas viram UM bloco: as quebras (e linhas em branco) saem exatamente como no texto colado
      const start = i;
      const block: string[] = [];
      while (i < lines.length && !/^\s*- /.test(lines[i]) && !/^\s*\d+\. /.test(lines[i]) && !/^>\s?/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      out.push(<span key={`p${start}`} className="block">{inline(block.join('\n'))}</span>);
    }
  }
  // pre-wrap: mantém exatamente os espaços, recuos e linhas em branco do texto colado
  return <div className={cn('whitespace-pre-wrap break-words', className)}>{out}</div>;
}

/**
 * Caixa de texto com formatação visível na hora (negrito, listas…) que cresce junto com o texto.
 * Aceita as mesmas props de um textarea (name/defaultValue em formulários, ou value/onChange).
 */
export function RichTextarea({ name, value, defaultValue, onChange, rows = 4, placeholder, disabled, className, id }: { name?: string; value?: string; defaultValue?: string | null; onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void; rows?: number; placeholder?: string; disabled?: boolean; className?: string; id?: string }) {
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value ?? inner;
  return (
    <>
      <RichEditor
        id={id}
        className={className}
        value={current}
        minRows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(v) => {
          setInner(v);
          onChange?.({ target: { value: v } } as ChangeEvent<HTMLTextAreaElement>);
        }}
      />
      {name && <input type="hidden" name={name} value={current} disabled={disabled} />}
    </>
  );
}
