'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Code, Italic, Link2, List, ListOrdered, Quote, Strikethrough, Underline } from 'lucide-react';
import { domToMd, mdToHtml } from '@/lib/rich-markdown';
import { cn } from '@/lib/utils';

const BTN = [
  { cmd: 'bold', label: 'Negrito (Ctrl+B)', Icon: Bold, state: 'bold' },
  { cmd: 'italic', label: 'Itálico (Ctrl+I)', Icon: Italic, state: 'italic' },
  { cmd: 'underline', label: 'Sublinhado (Ctrl+U)', Icon: Underline, state: 'underline' },
  { cmd: 'strikeThrough', label: 'Riscado', Icon: Strikethrough, state: 'strikeThrough' },
  null,
  { cmd: 'link', label: 'Link', Icon: Link2 },
  { cmd: 'insertOrderedList', label: 'Lista numerada', Icon: ListOrdered, state: 'insertOrderedList' },
  { cmd: 'insertUnorderedList', label: 'Lista', Icon: List, state: 'insertUnorderedList' },
  null,
  { cmd: 'quote', label: 'Citação', Icon: Quote },
  { cmd: 'code', label: 'Código', Icon: Code },
] as const;

/**
 * Editor visual: o negrito, itálico, listas etc. aparecem NA HORA enquanto você escreve, e a caixa cresce
 * junto com o texto. O que fica salvo é o mesmo texto de sempre (com marcação leve), então nada muda nos
 * textos já escritos nem na exibição para o cliente.
 */
export function RichEditor({ value, onChange, disabled, placeholder, minRows = 4, className, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; minRows?: number; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [empty, setEmpty] = useState(!value.trim());

  // coloca o texto no editor; só refaz quando o valor muda "de fora" (ex.: trocou de versão), nunca ao digitar
  useEffect(() => {
    const el = ref.current;
    if (!el || last.current === value) return;
    el.innerHTML = mdToHtml(value);
    last.current = value;
    setEmpty(!value.trim());
  }, [value]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const md = domToMd(el);
    last.current = md;
    setEmpty(!md.trim());
    onChange(md);
  }, [onChange]);

  const refreshState = useCallback(() => {
    const el = ref.current;
    if (!el || !el.contains(document.getSelection()?.anchorNode ?? null)) return;
    const next: Record<string, boolean> = {};
    for (const b of BTN) if (b && 'state' in b) { try { next[b.cmd] = document.queryCommandState(b.state); } catch {} }
    setActive(next);
  }, []);
  useEffect(() => {
    document.addEventListener('selectionchange', refreshState);
    return () => document.removeEventListener('selectionchange', refreshState);
  }, [refreshState]);

  function run(cmd: string) {
    const el = ref.current;
    if (!el || disabled) return;
    if (document.activeElement !== el) el.focus();
    if (cmd === 'link') {
      const url = window.prompt('Endereço do link (https://…)', 'https://');
      if (!url || url === 'https://') return;
      document.execCommand('createLink', false, url);
    } else if (cmd === 'quote') {
      document.execCommand('formatBlock', false, 'blockquote');
    } else if (cmd === 'code') {
      const sel = document.getSelection()?.toString() ?? '';
      if (sel) document.execCommand('insertHTML', false, `<code>${sel.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</code>`);
    } else {
      document.execCommand(cmd);
    }
    refreshState();
  }

  return (
    <div className={cn('rounded-2xl border border-wine/20 bg-white transition focus-within:border-wine focus-within:ring-2 focus-within:ring-wine/15', disabled && 'opacity-70')}>
      {!disabled && (
        <div role="toolbar" aria-label="Formatação" className="flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-wine/15 bg-blush/50 px-2 py-1.5">
          {BTN.map((b, i) =>
            b ? (
              <button key={b.cmd} type="button" title={b.label} aria-label={b.label} aria-pressed={'state' in b ? !!active[b.cmd] : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => run(b.cmd)} className={cn('rounded-lg p-2 transition', 'state' in b && active[b.cmd] ? 'bg-wine text-white' : 'text-wine hover:bg-wine/10')}>
                <b.Icon className="size-4" />
              </button>
            ) : (
              <span key={i} className="mx-1 h-5 w-px bg-wine/20" aria-hidden />
            ),
          )}
        </div>
      )}
      <div className="relative">
        {empty && placeholder && <span className="pointer-events-none absolute left-4 top-3 text-ink/35" aria-hidden>{placeholder}</span>}
        <div
          ref={ref}
          id={id}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck
          onInput={sync}
          onBlur={sync}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertHTML', false, mdToHtml(text.replace(/\r\n/g, '\n')));
            sync();
          }}
          style={{ minHeight: `${minRows * 1.65 + 1.5}rem` }}
          className={cn(
            'w-full whitespace-pre-wrap break-words px-4 py-3 leading-relaxed outline-none',
            '[&_b]:font-bold [&_strong]:font-bold [&_u]:underline [&_s]:line-through [&_a]:text-wine [&_a]:underline',
            '[&_code]:rounded [&_code]:bg-wine/10 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]',
            '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6',
            '[&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-wine/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink/75',
            className,
          )}
        />
      </div>
    </div>
  );
}
