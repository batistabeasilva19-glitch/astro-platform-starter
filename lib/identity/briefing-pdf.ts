import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { BRIEFING_SECTIONS, isAnswered, answeredCount, type Answers } from './briefing';

const WINE = rgb(0.467, 0.078, 0.188);
const INK = rgb(0.157, 0.157, 0.157);
const MUTED = rgb(0.45, 0.45, 0.45);
const BLUSH = rgb(1, 0.906, 0.898);
const W = 595.28;
const H = 841.89;
const M = 52;
const BOTTOM = 62;

export interface BriefingPdfInput {
  brandName: string;
  projectName: string;
  clientName: string;
  answers: Answers;
  references: { url: string; caption: string; name: string }[];
  submittedBy?: string | null;
  submittedAt?: string | null;
  /** endereço do logo branco (PNG) para o cabeçalho */
  logoUrl?: string;
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

/** Baixa uma imagem e a converte (se possível) para JPEG leve; PNG/JPEG simples entram como estão. */
export async function loadImage(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    let bytes: Uint8Array = new Uint8Array(await res.arrayBuffer());
    try {
      const sharp = (await import('sharp')).default;
      bytes = new Uint8Array(await sharp(Buffer.from(bytes)).rotate().resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 78 }).toBuffer());
      return await doc.embedJpg(bytes);
    } catch {
      // sem sharp (ou formato incomum): tenta embutir direto
    }
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (bytes.length > 4 * 1024 * 1024) return null;
    if (isPng) return await doc.embedPng(bytes);
    if (isJpg) return await doc.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

/** Gera o PDF do formulário da marca (cabeçalho Soltria, respostas por seção, fotos de referência). */
export async function buildBriefingPdf(input: BriefingPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Formulário da marca — ${input.brandName}`);
  doc.setAuthor('Soltria');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);

  /** troca o que a fonte padrão não consegue desenhar (emojis, símbolos) */
  const safe = (t: string, font: PDFFont) =>
    [...t.replace(/\t/g, ' ').replace(/ /g, ' ')]
      .map((ch) => {
        if (ch === '\n') return ch;
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return ch === '♡' || ch === '✦' ? '' : '?';
        }
      })
      .join('');

  const wrap = (text: string, font: PDFFont, size: number, max: number) => {
    const lines: string[] = [];
    for (const para of safe(text, font).split('\n')) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      let cur = '';
      for (const word of para.split(/\s+/)) {
        const test = cur ? `${cur} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= max) cur = test;
        else {
          if (cur) lines.push(cur);
          // palavra maior que a linha (links longos): quebra por caracteres
          if (font.widthOfTextAtSize(word, size) > max) {
            let chunk = '';
            for (const ch of word) {
              if (font.widthOfTextAtSize(chunk + ch, size) > max) {
                lines.push(chunk);
                chunk = ch;
              } else chunk += ch;
            }
            cur = chunk;
          } else cur = word;
        }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  };

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const ensure = (need: number) => {
    if (y - need < BOTTOM) newPage();
  };
  const text = (t: string, x: number, yy: number, size: number, font: PDFFont, color = INK) => page.drawText(safe(t, font), { x, y: yy, size, font, color });

  // ── cabeçalho (faixa vinho com o logo) ─────────────────────────────────
  const bandH = 128;
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: WINE });
  let logoDrawn = false;
  if (input.logoUrl) {
    try {
      const res = await fetch(input.logoUrl);
      if (res.ok) {
        const img = await doc.embedPng(new Uint8Array(await res.arrayBuffer()));
        const lw = 170;
        const lh = (img.height / img.width) * lw;
        page.drawImage(img, { x: M, y: H - bandH / 2 - lh / 2 + 6, width: lw, height: lh });
        logoDrawn = true;
      }
    } catch {}
  }
  if (!logoDrawn) text('Soltria', M, H - 70, 34, serif, rgb(1, 1, 1));
  const title = 'Formulário da marca';
  text(title, W - M - serif.widthOfTextAtSize(title, 22), H - 62, 22, serif, rgb(1, 1, 1));
  const sub = safe(input.brandName, regular);
  text(sub, W - M - regular.widthOfTextAtSize(sub, 11), H - 82, 11, regular, BLUSH);
  y = H - bandH - 34;

  // ── dados do projeto ───────────────────────────────────────────────────
  const prog = answeredCount(input.answers);
  const meta: [string, string][] = [
    ['Marca', input.brandName],
    ['Projeto', input.projectName],
    ['Respostas', `${prog.answered} de ${prog.total} perguntas`],
    ['Status', input.submittedAt ? `Respondido${input.submittedBy ? ` por ${input.submittedBy}` : ''} em ${fmtDate(input.submittedAt)}` : 'Em preenchimento'],
  ];
  for (const [k, v] of meta) {
    text(k.toUpperCase(), M, y, 7.5, bold, WINE);
    const lines = wrap(v, regular, 10.5, W - 2 * M - 90);
    lines.forEach((l, i) => text(l, M + 90, y - i * 14, 10.5, regular));
    y -= Math.max(1, lines.length) * 14 + 4;
  }
  y -= 14;

  // ── perguntas e respostas ──────────────────────────────────────────────
  const width = W - 2 * M;
  for (const [si, section] of BRIEFING_SECTIONS.entries()) {
    ensure(70);
    text(`${String(si + 1).padStart(2, '0')}  ${section.title}`, M, y, 15, serif, WINE);
    y -= 7;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.467, 0.078, 0.188), opacity: 0.35 });
    y -= 20;
    for (const q of section.questions) {
      const a = input.answers[q.id];
      const answered = isAnswered(a);
      const value = Array.isArray(a) ? a.join('  ·  ') : (a ?? '').trim();
      const qLines = wrap(q.label, bold, 9.5, width);
      const aLines = wrap(answered ? value : 'Sem resposta', regular, 10.5, width - 12);
      ensure(qLines.length * 12 + Math.min(aLines.length, 3) * 14 + 22);
      qLines.forEach((l) => {
        text(l, M, y, 9.5, bold, INK);
        y -= 12;
      });
      y -= 3;
      for (const l of aLines) {
        ensure(16);
        text(l, M + 12, y, 10.5, regular, answered ? INK : MUTED);
        y -= 14;
      }
      y -= 10;
    }
    y -= 6;
  }

  // ── fotos de referência ────────────────────────────────────────────────
  if (input.references.length) {
    newPage();
    text('Fotos de referência', M, y, 18, serif, WINE);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: WINE, opacity: 0.35 });
    y -= 24;
    const colW = (width - 18) / 2;
    const maxH = 210;
    let col = 0;
    let rowH = 0;
    for (const ref of input.references) {
      const img = await loadImage(doc, ref.url);
      const capLines = ref.caption ? wrap(ref.caption, regular, 8.5, colW) : [];
      const imgH = img ? Math.min(maxH, (img.height / img.width) * colW) : 24;
      const cellH = imgH + (capLines.length ? capLines.length * 11 + 6 : 0) + 18;
      if (col === 0) ensure(cellH);
      else if (y - Math.max(rowH, cellH) < BOTTOM) {
        // não cabe a linha: começa outra página
        newPage();
        col = 0;
        rowH = 0;
      }
      const x = M + col * (colW + 18);
      if (img) {
        const w = Math.min(colW, (img.width / img.height) * imgH);
        page.drawRectangle({ x, y: y - imgH, width: colW, height: imgH, color: BLUSH });
        page.drawImage(img, { x: x + (colW - w) / 2, y: y - imgH, width: w, height: imgH });
      } else {
        text(`(imagem não pôde ser incluída: ${ref.name})`, x, y - 14, 8.5, regular, MUTED);
      }
      capLines.forEach((l, i) => text(l, x, y - imgH - 12 - i * 11, 8.5, regular, MUTED));
      rowH = Math.max(rowH, cellH);
      col++;
      if (col === 2) {
        y -= rowH;
        col = 0;
        rowH = 0;
      }
    }
  }

  // ── rodapé em todas as páginas ─────────────────────────────────────────
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const left = safe(`Soltria · Formulário da marca — ${input.brandName}`, regular);
    p.drawText(left, { x: M, y: 30, size: 8, font: regular, color: MUTED });
    const right = `pág. ${i + 1} de ${pages.length}`;
    p.drawText(right, { x: W - M - regular.widthOfTextAtSize(right, 8), y: 30, size: 8, font: regular, color: MUTED });
  });

  return doc.save();
}
