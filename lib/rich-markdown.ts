/**
 * Ponte entre o editor visual (HTML) e o texto salvo (marcação leve, a mesma que o RichText exibe):
 *   **negrito**  _itálico_  ++sublinhado++  ~~riscado~~  `código`  [texto](link)
 *   "- " lista · "1. " lista numerada · "> " citação
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Rule = { re: RegExp; html: (m: RegExpExecArray, inner: string) => string; lead?: boolean; group: number };
const RULES: Rule[] = [
  { re: /`([^`\n]+)`/, group: 1, html: (_m, i) => `<code>${i}</code>` },
  { re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/, group: 1, html: (m, i) => `<a href="${esc(m[2])}">${i}</a>` },
  { re: /\*\*([^*\n]+)\*\*/, group: 1, html: (_m, i) => `<strong>${i}</strong>` },
  { re: /\+\+([^+\n]+)\+\+/, group: 1, html: (_m, i) => `<u>${i}</u>` },
  { re: /~~([^~\n]+)~~/, group: 1, html: (_m, i) => `<s>${i}</s>` },
  { re: /(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/, group: 2, lead: true, html: (_m, i) => `<em>${i}</em>` },
];

function inlineHtml(text: string): string {
  let best: { m: RegExpExecArray; r: Rule } | null = null;
  for (const r of RULES) {
    const m = r.re.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { m, r };
  }
  if (!best) return esc(text);
  const { m, r } = best;
  const lead = r.lead ? m[1] : '';
  return esc(text.slice(0, m.index)) + esc(lead) + r.html(m, inlineHtml(m[r.group])) + inlineHtml(text.slice(m.index + m[0].length));
}

/** Texto salvo → HTML para o editor. */
export function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const ul = /^\s*- (.*)$/, ol = /^\s*\d+\. (.*)$/, q = /^>\s?(.*)$/;
    if (ul.test(line) || ol.test(line)) {
      const re = ul.test(line) ? ul : ol;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(`<li>${inlineHtml(re.exec(lines[i++])![1]) || '<br>'}</li>`);
      out.push(re === ul ? `<ul>${items.join('')}</ul>` : `<ol>${items.join('')}</ol>`);
    } else if (q.test(line)) {
      const qs: string[] = [];
      while (i < lines.length && q.test(lines[i])) qs.push(inlineHtml(q.exec(lines[i++])![1]));
      out.push(`<blockquote>${qs.join('<br>')}</blockquote>`);
    } else {
      out.push(`<div>${inlineHtml(line) || '<br>'}</div>`);
      i++;
    }
  }
  return out.join('');
}

// ── editor (HTML) → texto salvo ──────────────────────────────────────────
function wrap(mark: string, inner: string): string {
  const core = inner.trim();
  if (!core) return inner;
  const lead = inner.slice(0, inner.length - inner.trimStart().length);
  const trail = inner.slice(inner.trimEnd().length);
  return `${lead}${mark}${core}${mark}${trail}`;
}

function inlineMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/ /g, ' ').replace(/\n/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') return '\n';
  const inner = [...el.childNodes].map(inlineMd).join('');
  const style = el.style;
  let out = inner;
  if (tag === 'B' || tag === 'STRONG' || Number(style.fontWeight) >= 600 || style.fontWeight === 'bold') out = wrap('**', out);
  if (tag === 'I' || tag === 'EM' || style.fontStyle === 'italic') out = wrap('_', out);
  if (tag === 'U' || style.textDecorationLine?.includes('underline')) out = wrap('++', out);
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || style.textDecorationLine?.includes('line-through')) out = wrap('~~', out);
  if (tag === 'CODE') out = wrap('`', out);
  if (tag === 'A') {
    const href = el.getAttribute('href') ?? '';
    if (/^(https?:|mailto:)/i.test(href) && inner.trim()) out = `[${inner.trim()}](${href})`;
  }
  return out;
}

const BLOCKS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'UL', 'OL', 'PRE']);

/** HTML do editor → texto salvo. Cada linha do editor vira uma linha do texto. */
export function domToMd(root: HTMLElement): string {
  const lines: string[] = [];
  const pushText = (s: string) => s.split('\n').forEach((l) => lines.push(l));
  const walk = (parent: Node) => {
    let buf = '';
    const flush = () => { if (buf !== '') { pushText(buf); buf = ''; } };
    for (const n of [...parent.childNodes]) {
      if (n.nodeType === Node.ELEMENT_NODE && BLOCKS.has((n as HTMLElement).tagName)) {
        flush();
        const el = n as HTMLElement;
        if (el.tagName === 'UL' || el.tagName === 'OL') {
          let k = 1;
          for (const li of [...el.children]) lines.push(`${el.tagName === 'UL' ? '- ' : `${k++}. `}${[...li.childNodes].map(inlineMd).join('').replace(/\n/g, ' ').trim()}`);
        } else if (el.tagName === 'BLOCKQUOTE') {
          const t = [...el.childNodes].map(inlineMd).join('').replace(/\n+$/, '');
          t.split('\n').forEach((l) => lines.push(`> ${l}`));
        } else if ([...el.children].some((c) => BLOCKS.has(c.tagName))) {
          walk(el);
        } else {
          const t = [...el.childNodes].map(inlineMd).join('');
          lines.push(...(t === '' || t === '\n' ? [''] : t.replace(/\n$/, '').split('\n')));
        }
      } else buf += inlineMd(n);
    }
    flush();
  };
  walk(root);
  return lines.join('\n').replace(/\s+$/, '');
}
