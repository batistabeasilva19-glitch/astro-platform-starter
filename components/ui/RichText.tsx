'use client';

import { useRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Bold, Code, Italic, Link2, List, ListOrdered, Quote, Strikethrough, Underline } from 'lucide-react';
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

const BUTTONS = [
  { id: 'bold', label: 'Negrito (Ctrl+B)', Icon: Bold },
  { id: 'italic', label: 'Itálico (Ctrl+I)', Icon: Italic },
  { id: 'underline', label: 'Sublinhado (Ctrl+U)', Icon: Underline },
  { id: 'strike', label: 'Riscado', Icon: Strikethrough },
  null,
  { id: 'link', label: 'Link', Icon: Link2 },
  { id: 'ol', label: 'Lista numerada', Icon: ListOrdered },
  { id: 'ul', label: 'Lista', Icon: List },
  null,
  { id: 'quote', label: 'Citação', Icon: Quote },
  { id: 'code', label: 'Código', Icon: Code },
] as const;

const WRAP: Record<string, [string, string]> = { bold: ['**', '**'], italic: ['_', '_'], underline: ['++', '++'], strike: ['~~', '~~'], code: ['`', '`'] };

/** Caixa de texto com barra de formatação (B / I / U / riscado / link / listas / citação / código). */
export function RichTextarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function commit(el: HTMLTextAreaElement, start: number, end: number, selStart: number, selEnd: number, insert: string) {
    el.focus();
    el.setRangeText(insert, start, end, 'preserve');
    el.setSelectionRange(selStart, selEnd);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function apply(id: string) {
    const el = ref.current;
    if (!el || el.disabled || el.readOnly) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e);

    if (WRAP[id]) {
      const [a, b] = WRAP[id];
      // já formatado? remove a marcação
      if (value.slice(s - a.length, s) === a && value.slice(e, e + b.length) === b) {
        commit(el, s - a.length, e + b.length, s - a.length, e - a.length, sel);
      } else {
        commit(el, s, e, s + a.length, s + a.length + sel.length, a + sel + b);
      }
      return;
    }
    if (id === 'link') {
      const url = window.prompt('Endereço do link (https://…)', 'https://');
      if (!url || url === 'https://') return;
      const text = sel || 'link';
      commit(el, s, e, s + 1, s + 1 + text.length, `[${text}](${url})`);
      return;
    }
    // listas e citação: prefixo em cada linha da seleção
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const nl = value.indexOf('\n', e);
    const lineEnd = nl === -1 ? value.length : nl;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const strip = (l: string) => l.replace(/^\s*(?:- |\d+\. |>\s?)/, '');
    const marker = id === 'ul' ? /^\s*- / : id === 'ol' ? /^\s*\d+\. / : /^>\s?/;
    const allOn = lines.every((l) => marker.test(l));
    const next = lines.map((l, i) => (allOn ? strip(l) : id === 'ul' ? `- ${strip(l)}` : id === 'ol' ? `${i + 1}. ${strip(l)}` : `> ${strip(l)}`)).join('\n');
    commit(el, lineStart, lineEnd, lineStart, lineStart + next.length, next);
  }

  return (
    <div>
      <div role="toolbar" aria-label="Formatação" className="flex flex-wrap items-center gap-0.5 rounded-t-2xl border border-b-0 border-wine/20 bg-blush/50 px-2 py-1.5">
        {BUTTONS.map((b, i) =>
          b ? (
            <button
              key={b.id}
              type="button"
              title={b.label}
              aria-label={b.label}
              disabled={p.disabled || p.readOnly}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(b.id)}
              className="rounded-lg p-2 text-wine transition hover:bg-wine/10 disabled:opacity-40"
            >
              <b.Icon className="size-4" />
            </button>
          ) : (
            <span key={i} className="mx-1 h-5 w-px bg-wine/20" aria-hidden />
          ),
        )}
      </div>
      <textarea
        {...p}
        ref={ref}
        onKeyDown={(e) => {
          p.onKeyDown?.(e);
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            const id = ({ b: 'bold', i: 'italic', u: 'underline' } as Record<string, string>)[e.key.toLowerCase()];
            if (id) {
              e.preventDefault();
              apply(id);
            }
          }
        }}
        className={cn('field min-h-24 resize-y !rounded-t-none leading-relaxed', className)}
      />
    </div>
  );
}
