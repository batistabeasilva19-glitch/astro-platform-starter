'use client';

import { useState } from 'react';
import { ExternalLink, Plus, X } from 'lucide-react';
import type { Answers as IdAnswers, Question as IdQuestion } from '@/lib/identity/briefing';
import { LINK_KINDS, decodeLink, encodeLink, type Answers, type Question } from '@/lib/social-form/questions';
import { Input, Select } from '@/components/ui/Fields';
import { Button } from '@/components/ui/Button';
import { QuestionField } from '@/components/identity/briefing/QuestionField';
import { cn } from '@/lib/utils';

type Props = { q: Question; answers: Answers; set: (id: string, v: string | string[]) => void; toggle: (q: Question, opt: string) => void; error?: boolean };

const Label = ({ q }: { q: Question }) => (
  <>
    <label htmlFor={`f-${q.id}`} className="mb-2 block text-[0.95rem] leading-snug text-ink">
      {q.label} {q.required && <span className="text-wine" aria-label="obrigatório">*</span>}
    </label>
    {q.hint && <p className="-mt-1 mb-2 text-xs text-ink/50">{q.hint}</p>}
  </>
);

/** Uma pergunta do formulário de perfil (qualquer tipo). */
export function SocialQuestion({ q, answers, set, toggle, error }: Props) {
  const list = (answers[q.id] as string[] | undefined) ?? [];
  if (q.type === 'list') return <Wrap q={q} error={error}><ListInput id={q.id} items={list} onChange={(v) => set(q.id, v)} placeholder={q.placeholder} /></Wrap>;
  if (q.type === 'links') return <Wrap q={q} error={error}><LinksInput items={list} onChange={(v) => set(q.id, v)} /></Wrap>;
  if (q.type === 'colors') return <Wrap q={q} error={error}><ColorsInput items={list} onChange={(v) => set(q.id, v)} /></Wrap>;
  if (q.type === 'scale') return <Wrap q={q} error={error}><ScaleInput value={(answers[q.id] as string) ?? ''} labels={q.scale ?? ['', '']} onChange={(v) => set(q.id, v)} /></Wrap>;
  return <QuestionField q={q as IdQuestion} answers={answers as IdAnswers} set={set} toggle={toggle as never} error={error} />;
}

function Wrap({ q, error, children }: { q: Question; error?: boolean; children: React.ReactNode }) {
  return (
    <div id={`q-${q.id}`}>
      <Label q={q} />
      {children}
      {error && <p className="mt-1.5 text-xs text-wine">Esta pergunta é obrigatória.</p>}
    </div>
  );
}

/** Lista livre: escreve, toca em Adicionar (ou Enter) e o item vira um cartão que dá para remover. */
function ListInput({ id, items, onChange, placeholder }: { id: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, t]);
    setText('');
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={`${it}-${i}`} className="animate-pop flex items-start gap-2 rounded-2xl border border-wine/20 bg-white px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1 break-words">{it}</span>
              <button type="button" aria-label="Remover" onClick={() => onChange(items.filter((_, k) => k !== i))} className="shrink-0 rounded-full p-1 text-wine/60 hover:bg-blush hover:text-wine"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input id={`f-${id}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} maxLength={300} />
        <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}><Plus className="size-4" /> Adicionar</Button>
      </div>
      {text.trim() && <p className="text-xs text-wine/70">Falta tocar em “Adicionar” para guardar este item.</p>}
    </div>
  );
}

function LinksInput({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [kind, setKind] = useState<string>(LINK_KINDS[0]);
  const [url, setUrl] = useState('');
  const add = () => {
    const u = url.trim();
    if (!u) return;
    onChange([...items, encodeLink(kind, u)]);
    setUrl('');
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((raw, i) => {
            const l = decodeLink(raw);
            const href = /^https?:\/\//i.test(l.url) ? l.url : /^[\w.-]+\.[a-z]{2,}/i.test(l.url) ? `https://${l.url}` : null;
            return (
              <li key={`${raw}-${i}`} className="animate-pop flex items-center gap-2 rounded-2xl border border-wine/20 bg-white px-4 py-2.5 text-sm">
                <span className="shrink-0 rounded-full bg-blush px-2.5 py-0.5 text-xs text-wine">{l.kind}</span>
                <span className="min-w-0 flex-1 truncate">{l.url}</span>
                {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Abrir" className="shrink-0 rounded-full p-1 text-wine/60 hover:bg-blush hover:text-wine"><ExternalLink className="size-4" /></a>}
                <button type="button" aria-label="Remover" onClick={() => onChange(items.filter((_, k) => k !== i))} className="shrink-0 rounded-full p-1 text-wine/60 hover:bg-blush hover:text-wine"><X className="size-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[13rem_1fr_auto]">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de link">{LINK_KINDS.map((k) => <option key={k}>{k}</option>)}</Select>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Cole o link ou @ aqui" maxLength={500} aria-label="Endereço do link" />
        <Button type="button" variant="outline" onClick={add} disabled={!url.trim()}><Plus className="size-4" /> Adicionar</Button>
      </div>
      {url.trim() && <p className="text-xs text-wine/70">Falta tocar em “Adicionar” para guardar este link.</p>}
    </div>
  );
}

function ColorsInput({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [color, setColor] = useState('#771430');
  const [hex, setHex] = useState('#771430');
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
  const pick = (v: string) => { setColor(v); setHex(v); };
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((c) => (
            <li key={c} className="animate-pop flex items-center gap-2 rounded-full border border-wine/20 bg-white py-1 pl-1 pr-2 text-xs">
              <span className="size-7 rounded-full ring-1 ring-ink/15" style={{ background: c }} />
              <span className="font-mono uppercase">{c}</span>
              <button type="button" aria-label={`Remover ${c}`} onClick={() => onChange(items.filter((x) => x !== c))} className="rounded-full p-0.5 text-wine/60 hover:text-wine"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={color} onChange={(e) => pick(e.target.value)} aria-label="Seletor de cor" className="size-11 cursor-pointer rounded-full border border-wine/25 bg-white p-1" />
        <Input value={hex} onChange={(e) => { setHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setColor(e.target.value); }} placeholder="#771430" className={cn('!w-32 font-mono', !valid && hex && 'border-wine')} maxLength={7} aria-label="Código da cor" />
        <Button type="button" variant="outline" disabled={!valid || items.includes(hex.toLowerCase())} onClick={() => onChange([...items, hex.toLowerCase()])}><Plus className="size-4" /> Adicionar cor</Button>
      </div>
    </div>
  );
}

function ScaleInput({ value, labels, onChange }: { value: string; labels: [string, string]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex gap-2" role="radiogroup">
        {['1', '2', '3', '4', '5'].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? '' : n)} className={cn('size-12 rounded-full border text-sm transition active:scale-95', value === n ? 'border-wine bg-wine text-white' : 'border-wine/30 bg-white text-wine hover:bg-blush')}>{n}</button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.7rem] text-ink/50"><span>{labels[0]}</span><span>{labels[1]}</span></div>
    </div>
  );
}
