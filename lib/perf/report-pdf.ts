import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { loadImage } from '@/lib/identity/briefing-pdf';
import { delta, fmtDec, fmtInt, fmtMoney, fmtPct, fmtRatio, fmtSigned, fmtSignedPct, type Delta, type SeriesPoint } from './calc';
import type { ReportData } from './report';
import { visibleSections } from './sections';
import { FORMAT_GROUPS, PLATFORM_LABEL, type ReportEdits } from './types';

const WINE = rgb(0.467, 0.078, 0.188);
const INK = rgb(0.157, 0.157, 0.157);
const MUTED = rgb(0.5, 0.46, 0.47);
const BLUSH = rgb(1, 0.906, 0.898);
const SOFT = rgb(1, 0.965, 0.961);
const GRID = rgb(0.914, 0.851, 0.859);
const SERIES = [rgb(0.467, 0.078, 0.188), rgb(0.788, 0.439, 0.498), rgb(0.157, 0.157, 0.157), rgb(0.91, 0.706, 0.722)];
const W = 595.28;
const H = 841.89;
const M = 48;
const CW = W - M * 2;
const TOP = H - 52;
const BOTTOM = 56;

const hexToRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const REPLACE: Record<string, string> = { '−': '-', '→': '>', '↓': '', '≥': '>=', '÷': '/', '•': '-', '♡': '', '✦': '' };

export interface ReportPdfInput {
  data: ReportData;
  edits: ReportEdits;
  /** miniaturas (URLs assinadas) por id de conteúdo e logo/avatar do cliente */
  thumbs: Record<string, string>;
  clientLogoUrl: string | null;
  soltriaLogoUrl: string;
}

/** Gera o PDF A4 do relatório mensal. Gráficos desenhados direto nas páginas (nunca cortados ou separados do título). */
export async function buildReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const { data, edits } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`Relatório de desempenho — ${data.client.name} — ${data.label}`);
  doc.setAuthor('Soltria');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const accent = data.client.colors[0] ? hexToRgb(data.client.colors[0]) : null;

  const safe = (t: string, font: PDFFont) =>
    [...String(t).replace(/\t/g, ' ').replace(/ /g, ' ')]
      .map((ch) => {
        if (ch === '\n') return ch;
        const r = REPLACE[ch];
        if (r !== undefined) return r;
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return '?';
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
          cur = word;
          while (font.widthOfTextAtSize(cur, size) > max && cur.length > 1) {
            let i = cur.length - 1;
            while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > max) i--;
            lines.push(cur.slice(0, i));
            cur = cur.slice(i);
          }
        }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  };
  const fit = (t: string, font: PDFFont, size: number, max: number) => {
    let s = safe(t, font);
    if (font.widthOfTextAtSize(s, size) <= max) return s;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > max) s = s.slice(0, -1);
    return `${s}...`;
  };

  let page: PDFPage = doc.addPage([W, H]);
  let y = TOP;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = TOP;
  };
  const ensure = (need: number) => {
    if (y - need < BOTTOM) newPage();
  };
  const text = (t: string, x: number, yy: number, size: number, font: PDFFont, color: RGB = INK) => page.drawText(safe(t, font), { x, y: yy, size, font, color });
  const textR = (t: string, xr: number, yy: number, size: number, font: PDFFont, color: RGB = INK) => page.drawText(safe(t, font), { x: xr - font.widthOfTextAtSize(safe(t, font), size), y: yy, size, font, color });
  const textC = (t: string, xc: number, yy: number, size: number, font: PDFFont, color: RGB = INK) => page.drawText(safe(t, font), { x: xc - font.widthOfTextAtSize(safe(t, font), size) / 2, y: yy, size, font, color });

  const labelCaps = (t: string, x: number, yy: number, color: RGB = WINE) => text(t.toUpperCase(), x, yy, 7.5, bold, color);

  // ── capa (usa a primeira página) ───────────────────────────────────────
  page.drawRectangle({ x: 0, y: H * 0.38, width: W, height: H * 0.62, color: WINE });
  if (accent) page.drawRectangle({ x: 0, y: H * 0.38 - 5, width: W, height: 5, color: accent });
  const soltria = await fetch(input.soltriaLogoUrl).then(async (r) => (r.ok ? doc.embedPng(new Uint8Array(await r.arrayBuffer())) : null)).catch(() => null);
  if (soltria) {
    const lw = 190;
    page.drawImage(soltria, { x: M + 6, y: H - 70 - (soltria.height / soltria.width) * lw, width: lw, height: (soltria.height / soltria.width) * lw });
  } else text('Soltria', M, H - 90, 34, serif, rgb(1, 1, 1));
  let clientImg: PDFImage | null = null;
  if (input.clientLogoUrl) clientImg = await loadImage(doc, input.clientLogoUrl);
  if (clientImg) {
    const d = 78;
    page.drawCircle({ x: W - M - d / 2, y: H - 70 - d / 2 + 30, size: d / 2 + 3, color: rgb(1, 1, 1) });
    const fitSc = Math.min(d / clientImg.width, d / clientImg.height);
    page.drawImage(clientImg, { x: W - M - d / 2 - (clientImg.width * fitSc) / 2, y: H - 70 - d / 2 + 30 - (clientImg.height * fitSc) / 2, width: clientImg.width * fitSc, height: clientImg.height * fitSc });
  }
  text('RELATORIO DE DESEMPENHO  -  INSTAGRAM', M + 6, H * 0.38 + 150, 9, bold, rgb(1, 0.82, 0.8));
  const nameLines = wrap(data.client.name, serif, 40, CW - 12).slice(0, 2);
  nameLines.forEach((l, i) => text(l, M + 6, H * 0.38 + 100 - i * 46, 40, serif, rgb(1, 1, 1)));
  text(data.label, M + 6, H * 0.38 + 100 - nameLines.length * 46 - 6, 26, serif, BLUSH);
  if (data.client.handle) text(`@${data.client.handle.replace(/^@/, '')}`, M + 6, H * 0.38 + 24, 11, regular, rgb(1, 0.82, 0.8));
  text('Soltria  -  Beatriz Batista, Publicitaria', M + 6, 70, 9, regular, MUTED);
  text(`Gerado em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(data.generatedAt))}`, M + 6, 56, 8, regular, MUTED);

  // ── blocos reutilizáveis ───────────────────────────────────────────────
  const sectionHeader = (number: string, title: string, minBody = 150) => {
    if (y < TOP - 1) y -= 24; // respiro entre seções
    ensure(44 + minBody);
    labelCaps(number, M, y - 6, MUTED);
    text(title, M + 26, y - 8, 22, serif, WINE);
    y -= 20;
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.6, color: accent ?? GRID });
    y -= 22;
  };
  const sub = (t: string) => {
    y -= 6;
    ensure(34);
    labelCaps(t, M, y - 4);
    y -= 16;
  };
  const para = (t: string, size = 10) => {
    if (!t.trim()) return;
    const lines = wrap(t, regular, size, CW);
    for (const l of lines) {
      ensure(size + 6);
      if (l) text(l, M, y - size, size, regular, INK);
      y -= size + 4.5;
    }
    y -= 6;
  };
  const analysis = (t?: string) => {
    if (!t?.trim()) return;
    const lines = wrap(t, regular, 9.5, CW - 28);
    const h = 30 + lines.length * 13;
    ensure(h + 8);
    page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: BLUSH });
    labelCaps('Analise', M + 14, y - 16);
    lines.forEach((l, i) => text(l, M + 14, y - 31 - i * 13, 9.5, regular, INK));
    y -= h + 14;
  };
  const gap = (n = 10) => {
    y -= n;
  };

  const deltaColor = (d: Delta) => (d.dir === 'up' ? WINE : d.dir === 'down' ? INK : MUTED);
  const kpiGrid = (items: { label: string; value: string; line?: string; d?: Delta }[], cols = 3) => {
    const gw = (CW - 10 * (cols - 1)) / cols;
    const ch = 66;
    for (let i = 0; i < items.length; i += cols) {
      ensure(ch + 10);
      items.slice(i, i + cols).forEach((it, j) => {
        const x = M + j * (gw + 10);
        page.drawRectangle({ x, y: y - ch, width: gw, height: ch, color: SOFT, borderColor: GRID, borderWidth: 0.6 });
        labelCaps(it.label, x + 10, y - 16, MUTED);
        text(it.value, x + 10, y - 40, 20, serif, WINE);
        if (it.line) text(fit(it.line, regular, 8, gw - 20), x + 10, y - 56, 8, regular, it.d ? deltaColor(it.d) : MUTED);
      });
      y -= ch + 10;
    }
  };

  const niceMax = (max: number) => {
    if (max <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  };
  const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi` : n >= 1000 ? `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace('.', ',').replace(',0', '')} mil` : fmtInt(n));
  const CH = 150;
  const CL = 44;

  const chartFrame = (title: string, draw: (x0: number, x1: number, yTop: number, yBot: number) => void) => {
    ensure(CH + 40);
    labelCaps(title, M, y - 4, MUTED);
    y -= 14;
    draw(M + CL, W - M - 6, y - 4, y - CH + 22);
    y -= CH + 8;
  };
  const lineChart = (title: string, points: SeriesPoint[], fmt: (n: number) => string = fmtInt) => {
    const pts = points.filter((p): p is { label: string; value: number } => p.value != null);
    if (!pts.length) return;
    chartFrame(title, (x0, x1, top, bot) => {
      let min = Math.min(...pts.map((p) => p.value));
      let max = Math.max(...pts.map((p) => p.value));
      if (min === max) {
        min *= 0.95;
        max = max * 1.05 || 1;
      }
      const span = max - min;
      const lo = Math.max(0, min - span * 0.15);
      const hi = max + span * 0.15;
      const xs = (i: number) => (pts.length === 1 ? (x0 + x1) / 2 : x0 + (i / (pts.length - 1)) * (x1 - x0));
      const ys = (v: number) => bot + ((v - lo) / (hi - lo)) * (top - bot);
      for (const t of [lo, (lo + hi) / 2, hi]) {
        page.drawLine({ start: { x: x0, y: ys(t) }, end: { x: x1, y: ys(t) }, thickness: 0.5, color: GRID });
        textR(compact(Math.round(t)), x0 - 6, ys(t) - 3, 7, regular, MUTED);
      }
      for (let i = 1; i < pts.length; i++) page.drawLine({ start: { x: xs(i - 1), y: ys(pts[i - 1].value) }, end: { x: xs(i), y: ys(pts[i].value) }, thickness: 2, color: WINE });
      pts.forEach((p, i) => {
        page.drawCircle({ x: xs(i), y: ys(p.value), size: 3.2, color: rgb(1, 1, 1), borderColor: WINE, borderWidth: 1.6 });
        if (pts.length <= 8) textC(fmt(p.value), xs(i), ys(p.value) + 7, 7, regular, WINE);
      });
      const step = Math.ceil(pts.length / 7);
      pts.forEach((p, i) => (i % step === 0 || i === pts.length - 1) && textC(p.label, xs(i), bot - 12, 7, regular, MUTED));
    });
  };

  const barChart = (title: string, points: SeriesPoint[]) => {
    const pts = points.filter((p): p is { label: string; value: number } => p.value != null);
    if (!pts.length) return;
    chartFrame(title, (x0, x1, top, bot) => {
      const max = niceMax(Math.max(...pts.map((p) => p.value)));
      const ys = (v: number) => bot + (v / max) * (top - bot);
      for (const t of [0, max / 2, max]) {
        page.drawLine({ start: { x: x0, y: ys(t) }, end: { x: x1, y: ys(t) }, thickness: 0.5, color: GRID });
        textR(compact(Math.round(t)), x0 - 6, ys(t) - 3, 7, regular, MUTED);
      }
      const slot = (x1 - x0) / pts.length;
      const bw = Math.min(40, slot * 0.6);
      pts.forEach((p, i) => {
        const cx = x0 + slot * (i + 0.5);
        page.drawRectangle({ x: cx - bw / 2, y: bot, width: bw, height: Math.max(1, ys(p.value) - bot), color: WINE });
        textC(compact(Math.round(p.value)), cx, ys(p.value) + 4, 7, regular, WINE);
        if (pts.length <= 10 || i % 2 === 0) textC(p.label, cx, bot - 12, 7, regular, MUTED);
      });
    });
  };

  const stacked = (title: string, items: { label: string; likes: number; comments: number; shares: number; saves: number }[]) => {
    if (!items.length) return;
    const keys = [['likes', 'Curtidas'], ['comments', 'Comentarios'], ['shares', 'Compartilhamentos'], ['saves', 'Salvamentos']] as const;
    chartFrame(title, (x0, x1, top, bot) => {
      const totals = items.map((it) => it.likes + it.comments + it.shares + it.saves);
      const max = niceMax(Math.max(...totals));
      const ys = (v: number) => bot + (v / max) * (top - bot);
      for (const t of [0, max / 2, max]) {
        page.drawLine({ start: { x: x0, y: ys(t) }, end: { x: x1, y: ys(t) }, thickness: 0.5, color: GRID });
        textR(compact(Math.round(t)), x0 - 6, ys(t) - 3, 7, regular, MUTED);
      }
      const slot = (x1 - x0) / items.length;
      const bw = Math.min(44, slot * 0.6);
      items.forEach((it, i) => {
        const cx = x0 + slot * (i + 0.5);
        let acc = 0;
        keys.forEach(([k], ki) => {
          const v = it[k];
          if (v > 0) page.drawRectangle({ x: cx - bw / 2, y: ys(acc), width: bw, height: Math.max(0.5, ys(acc + v) - ys(acc)), color: SERIES[ki] });
          acc += v;
        });
        if (items.length <= 10 || i % 2 === 0) textC(it.label, cx, bot - 12, 7, regular, MUTED);
      });
    });
    // legenda logo abaixo (junto do gráfico)
    let lx = M;
    keys.forEach(([, label], ki) => {
      page.drawCircle({ x: lx + 3, y: y + 3, size: 3, color: SERIES[ki] });
      text(label, lx + 10, y, 7.5, regular, MUTED);
      lx += 18 + regular.widthOfTextAtSize(label, 7.5) + 10;
    });
    y -= 16;
  };

  const hbars = (title: string, items: { label: string; value: number | null; text?: string }[]) => {
    const list = items.filter((i): i is { label: string; value: number; text?: string } => i.value != null);
    if (!list.length) return;
    ensure(24 + list.length * 24);
    labelCaps(title, M, y - 4, MUTED);
    y -= 18;
    const max = Math.max(...list.map((i) => i.value)) || 1;
    const lw = 150;
    for (const it of list) {
      ensure(24);
      text(fit(it.label, regular, 8.5, lw - 6), M, y - 10, 8.5, regular, INK);
      page.drawRectangle({ x: M + lw, y: y - 12, width: CW - lw - 60, height: 9, color: BLUSH });
      page.drawRectangle({ x: M + lw, y: y - 12, width: Math.max(2, (it.value / max) * (CW - lw - 60)), height: 9, color: WINE });
      textR(it.text ?? fmtInt(it.value), W - M, y - 10, 8.5, bold, WINE);
      y -= 22;
    }
    y -= 4;
  };

  const compareBars = (title: string, rows: { label: string; cur: number | null; prev: number | null }[], curLabel: string, prevLabel: string) => {
    const list = rows.filter((r) => r.cur != null || r.prev != null);
    if (!list.length) return;
    ensure(30 + list.length * 34);
    labelCaps(title, M, y - 4, MUTED);
    y -= 18;
    const lw = 110;
    const bwMax = CW - lw - 70;
    for (const r of list) {
      ensure(36);
      const max = Math.max(r.cur ?? 0, r.prev ?? 0) || 1;
      text(r.label, M, y - 14, 8.5, regular, INK);
      ([[r.cur, SERIES[0], 0], [r.prev, SERIES[3], 1]] as const).forEach(([v, c, k]) => {
        page.drawRectangle({ x: M + lw, y: y - 11 - k * 11, width: bwMax, height: 8, color: BLUSH });
        if (v != null) page.drawRectangle({ x: M + lw, y: y - 11 - k * 11, width: Math.max(2, (v / max) * bwMax), height: 8, color: c });
        textR(v != null ? fmtInt(v) : '–', W - M, y - 10 - k * 11, 7.5, regular, MUTED);
      });
      y -= 30;
    }
    page.drawCircle({ x: M + 3, y: y + 2, size: 3, color: SERIES[0] });
    text(curLabel, M + 10, y - 1, 7.5, regular, MUTED);
    page.drawCircle({ x: M + 20 + regular.widthOfTextAtSize(safe(curLabel, regular), 7.5), y: y + 2, size: 3, color: SERIES[3] });
    text(prevLabel, M + 27 + regular.widthOfTextAtSize(safe(curLabel, regular), 7.5), y - 1, 7.5, regular, MUTED);
    y -= 18;
  };

  const funnelChart = (steps: { label: string; value: number }[]) => {
    if (steps.length < 2) return;
    ensure(24 + steps.length * 34);
    labelCaps('Funil de desempenho', M, y - 4, MUTED);
    y -= 18;
    steps.forEach((s, i) => {
      const w = Math.max(CW * 0.34, (s.value / steps[0].value) * CW);
      const x = M + (CW - w) / 2;
      if (i > 0) {
        const rate = steps[i - 1].value > 0 ? (s.value / steps[i - 1].value) * 100 : null;
        textC(rate != null ? `${rate.toFixed(rate < 10 ? 1 : 0).replace('.', ',')}% da etapa anterior` : '', W / 2, y - 7, 7, regular, MUTED);
        y -= 11;
      }
      page.drawRectangle({ x, y: y - 20, width: w, height: 20, color: SERIES[0], opacity: 1 - i * 0.12 });
      text(s.label, x + 10, y - 14, 9, regular, rgb(1, 1, 1));
      textR(fmtInt(s.value), x + w - 10, y - 14, 9, bold, rgb(1, 1, 1));
      y -= 23;
    });
    y -= 6;
  };

  const table = (head: string[], rows: (string | number)[][]) => {
    const first = Math.min(150, CW * 0.3);
    const other = (CW - first) / (head.length - 1);
    const colX = (i: number) => (i === 0 ? M : M + first + (i - 1) * other);
    const drawHead = () => {
      ensure(40);
      head.forEach((h, i) => (i === 0 ? text(h.toUpperCase(), M + 2, y - 10, 6.8, bold, WINE) : textR(h.toUpperCase(), colX(i) + other - 2, y - 10, 6.8, bold, WINE)));
      page.drawLine({ start: { x: M, y: y - 16 }, end: { x: W - M, y: y - 16 }, thickness: 0.6, color: GRID });
      y -= 22;
    };
    drawHead();
    for (const r of rows) {
      if (y - 20 < BOTTOM) {
        newPage();
        drawHead();
      }
      r.forEach((c, i) => (i === 0 ? text(fit(String(c), regular, 8.5, first - 6), M + 2, y - 9, 8.5, regular, INK) : textR(fit(String(c), regular, 8.5, other - 4), colX(i) + other - 2, y - 9, 8.5, regular, INK)));
      page.drawLine({ start: { x: M, y: y - 14 }, end: { x: W - M, y: y - 14 }, thickness: 0.3, color: GRID });
      y -= 19;
    }
    y -= 8;
  };

  const thumbCache = new Map<string, PDFImage | null>();
  const getThumb = async (id: string) => {
    if (!input.thumbs[id]) return null;
    if (!thumbCache.has(id)) thumbCache.set(id, await loadImage(doc, input.thumbs[id]));
    return thumbCache.get(id) ?? null;
  };

  const highlights = async () => {
    const cols = 3;
    const gw = (CW - 12 * (cols - 1)) / cols;
    const ih = 96;
    const ch = ih + 62;
    const items = data.rankings.slice(0, 9);
    for (let i = 0; i < items.length; i += cols) {
      ensure(ch + 12);
      for (const [j, r] of items.slice(i, i + cols).entries()) {
        const x = M + j * (gw + 12);
        const top = r.entries[0];
        page.drawRectangle({ x, y: y - ch, width: gw, height: ch, color: rgb(1, 1, 1), borderColor: GRID, borderWidth: 0.6 });
        page.drawRectangle({ x, y: y - ih, width: gw, height: ih, color: BLUSH });
        const img = await getThumb(top.id);
        if (img) {
          const sc = Math.min(gw / img.width, ih / img.height);
          page.drawImage(img, { x: x + (gw - img.width * sc) / 2, y: y - ih + (ih - img.height * sc) / 2, width: img.width * sc, height: img.height * sc });
        } else textC(FORMAT_GROUPS.find((g) => g.id === top.group)?.label ?? 'Conteudo', x + gw / 2, y - ih / 2, 8, regular, WINE);
        labelCaps(r.def.title, x + 8, y - ih - 14);
        text(fit(top.title, regular, 8, gw - 16), x + 8, y - ih - 28, 8, regular, INK);
        const v = r.def.unit === 'pct' ? fmtPct(top.value) : fmtInt(top.value);
        text(v, x + 8, y - ih - 47, 14, serif, WINE);
        text(fit(r.def.unitLabel, regular, 7, gw - 16 - serif.widthOfTextAtSize(safe(v, serif), 14) - 6), x + 14 + serif.widthOfTextAtSize(safe(v, serif), 14), y - ih - 47, 7, regular, MUTED);
      }
      y -= ch + 12;
    }
  };

  // ── seções ─────────────────────────────────────────────────────────────
  const { cur, prev, series } = data.profile;
  const t = edits.texts;
  const an = edits.analyses;
  const sections = visibleSections(data, edits);
  const insights = edits.insights.filter((i) => i.enabled && i.text.trim());
  const textBlock = (label: string, value?: string) => {
    if (!value?.trim()) return;
    sub(label);
    para(value);
  };

  let firstSection = true;
  for (const s of sections) {
    if (firstSection) newPage();
    firstSection = false;
    sectionHeader(s.number, s.title, ({ highlights: 200, overview: 220, published: 90, learnings: 110, recommendations: 90, next: 110, organic_paid: 120 } as Record<string, number>)[s.id] ?? 250);
    if (s.id === 'overview') {
      const vs = `vs ${data.prevRange.label}`;
      const dd = (a: number | null, b: number | null) => delta(a, b);
      const netD: Delta = { abs: cur.net, pct: cur.growthPct, dir: cur.net == null ? null : cur.net > 0 ? 'up' : cur.net < 0 ? 'down' : 'flat' };
      const line = (d: Delta, extra = vs) => (d.dir ? `${d.pct != null ? fmtSignedPct(d.pct) : fmtSigned(d.abs)}  ${extra}` : 'sem periodo anterior');
      kpiGrid([
        { label: 'Seguidores', value: fmtInt(cur.followersEnd), line: cur.net != null ? `${fmtSigned(cur.net)} no periodo  ${fmtSignedPct(cur.growthPct)}` : undefined, d: netD },
        { label: 'Alcance', value: fmtInt(cur.reach), line: line(dd(cur.reach, prev.reach)), d: dd(cur.reach, prev.reach) },
        { label: 'Impressoes', value: fmtInt(cur.impressions), line: line(dd(cur.impressions, prev.impressions)), d: dd(cur.impressions, prev.impressions) },
        { label: 'Engajamentos', value: fmtInt(cur.interactions), line: line(dd(cur.interactions, prev.interactions)), d: dd(cur.interactions, prev.interactions) },
        { label: 'Visitas ao perfil', value: fmtInt(cur.visits), line: line(dd(cur.visits, prev.visits)), d: dd(cur.visits, prev.visits) },
        { label: 'Cliques no link', value: fmtInt(cur.linkClicks), line: line(dd(cur.linkClicks, prev.linkClicks)), d: dd(cur.linkClicks, prev.linkClicks) },
      ]);
      textBlock('Resumo do mes', t.summary);
      textBlock('Principais resultados', t.results);
      if (insights.length) {
        sub('Destaques da analise');
        for (const i of insights) {
          const lines = wrap(i.text, regular, 9.5, CW - 14);
          ensure(lines.length * 13 + 6);
          page.drawCircle({ x: M + 3, y: y - 8, size: 1.8, color: WINE });
          lines.forEach((l, k) => text(l, M + 12, y - 11 - k * 13, 9.5, regular, INK));
          y -= lines.length * 13 + 5;
        }
        gap(6);
      }
      funnelChart(data.funnel);
    }
    if (s.id === 'growth') {
      kpiGrid([
        { label: 'Novos seguidores', value: fmtInt(cur.newFollowers) },
        { label: 'Seguidores perdidos', value: fmtInt(cur.lostFollowers) },
        { label: 'Crescimento liquido', value: fmtSigned(cur.net) },
        { label: 'Taxa de crescimento', value: fmtPct(cur.growthPct) },
      ].filter((k) => k.value !== '–'), 4);
      lineChart('Seguidores', series.followers);
      compareBars(`${data.label} x ${data.prevRange.label}`, [
        { label: 'Seguidores', cur: cur.followersEnd, prev: prev.followersEnd },
        { label: 'Alcance', cur: cur.reach, prev: prev.reach },
        { label: 'Impressoes', cur: cur.impressions, prev: prev.impressions },
        { label: 'Interacoes', cur: cur.interactions, prev: prev.interactions },
      ], data.label, data.prevRange.label);
      analysis(an.growth);
    }
    if (s.id === 'reach') {
      kpiGrid([{ label: 'Alcance', value: fmtInt(cur.reach) }, { label: 'Impressoes', value: fmtInt(cur.impressions) }, { label: 'Visualizacoes', value: fmtInt(cur.views) }].filter((k) => k.value !== '–'), 3);
      barChart('Alcance ao longo do periodo', series.reach);
      lineChart('Impressoes ao longo do periodo', series.impressions);
      analysis(an.reach);
    }
    if (s.id === 'engagement') {
      kpiGrid([{ label: 'Curtidas', value: fmtInt(cur.likes) }, { label: 'Comentarios', value: fmtInt(cur.comments) }, { label: 'Compartilhamentos', value: fmtInt(cur.shares) }, { label: 'Salvamentos', value: fmtInt(cur.saves) }].filter((k) => k.value !== '–'), 4);
      kpiGrid([
        { label: 'Engajamento por seguidores', value: fmtPct(cur.erFollowers), line: 'interacoes / seguidores x 100' },
        { label: 'Engajamento por alcance', value: fmtPct(cur.erReach), line: 'interacoes / alcance x 100' },
      ], 2);
      stacked('Interacoes por tipo', series.interactions);
      lineChart('Taxa de engajamento por alcance (%)', series.er.map((p) => ({ label: p.label, value: p.value == null ? null : Math.round(p.value * 100) / 100 })), (n) => fmtPct(n));
      analysis(an.engagement);
    }
    if (s.id === 'published') kpiGrid(FORMAT_GROUPS.map((g) => ({ label: g.plural, value: String(data.published.byFormat[g.id]) })), 4);
    if (s.id === 'highlights') {
      await highlights();
      analysis(an.highlights);
    }
    if (s.id === 'formats') {
      hbars('Alcance medio por formato', data.formats.map((f) => ({ label: `${f.plural} (${f.count})`, value: f.reach })));
      table(['Formato', 'Alcance', 'Engaj.', 'Compart.', 'Salvam.', 'Cliques', 'Conv.'], data.formats.map((f) => [f.plural, fmtInt(f.reach), fmtPct(f.er), fmtDec(f.shares), fmtDec(f.saves), fmtDec(f.clicks), fmtInt(f.conversions)]));
      analysis(an.formats);
    }
    if (s.id === 'pillars') {
      table(['Pilar', 'Conteudos', 'Alcance', 'Engaj.', 'Salvam.', 'Cliques', 'Conv.'], data.pillars.map((p) => [p.tag, p.count, fmtInt(p.reach), fmtPct(p.er), fmtDec(p.saves), fmtDec(p.clicks), fmtInt(p.conversions)]));
      if (data.objectives.length) {
        sub('Resultado por objetivo');
        table(['Objetivo', 'Conteudos', 'Indicador', 'Media', 'Melhor'], data.objectives.map((o) => [o.objective, o.count, o.metricLabel, o.metricKey === 'engagement_rate' ? fmtPct(o.value) : fmtDec(o.value), o.best?.title ?? '–']));
      }
      analysis(an.pillars);
    }
    if (s.id === 'paid' && data.paid) {
      const p = data.paid.totals;
      kpiGrid(([['Investimento', fmtMoney(p.investment)], ['Impressoes', fmtInt(p.impressions)], ['Cliques', fmtInt(p.clicks)], ['CTR', fmtPct(p.ctr)], ['CPC', fmtMoney(p.cpc)], ['CPM', fmtMoney(p.cpm)], ['Leads', fmtInt(p.leads)], ['CPL', fmtMoney(p.cpl)], ['Conversoes', fmtInt(p.conversions)], ['CPA', fmtMoney(p.cpa)], ['ROAS', fmtRatio(p.roas)]] as [string, string][]).filter(([, v]) => v !== '–').map(([label, value]) => ({ label, value })), 4);
      if (data.paid.campaigns.length) {
        sub('Campanhas');
        table(['Campanha', 'Plataforma', 'Invest.', 'Cliques', 'Leads', 'Conv.', 'ROAS'], data.paid.campaigns.map((c) => [c.name, PLATFORM_LABEL[c.platform] ?? c.platform, fmtMoney(c.totals.investment), fmtInt(c.totals.clicks), fmtInt(c.totals.leads), fmtInt(c.totals.conversions), fmtRatio(c.totals.roas)]));
      }
      const camp = data.paid.campaigns;
      hbars('Investimento por campanha (R$)', camp.map((c) => ({ label: c.name, value: c.totals.investment, text: fmtMoney(c.totals.investment) })));
      hbars('Leads por campanha', camp.map((c) => ({ label: c.name, value: c.totals.leads })));
      hbars('Conversoes por campanha', camp.map((c) => ({ label: c.name, value: c.totals.conversions })));
      analysis(an.paid);
    }
    if (s.id === 'organic_paid') {
      for (const r of data.organicPaid) {
        ensure(96);
        page.drawRectangle({ x: M, y: y - 84, width: CW, height: 84, color: SOFT, borderColor: GRID, borderWidth: 0.6 });
        text(fit(`${r.title}  -  ${r.campaigns.join(', ')}`, bold, 9, CW - 20), M + 10, y - 16, 9, bold, WINE);
        const colW = CW / 3;
        labelCaps('Organico', M + 10, y - 32);
        [`Alcance ${fmtInt(r.organic.reach)}`, `Engajamento ${fmtPct(r.organic.er)}`, `Cliques ${fmtInt(r.organic.clicks)}`].forEach((l, i) => text(l, M + 10, y - 45 - i * 11, 8.5, regular, INK));
        labelCaps('Pago', M + 10 + colW, y - 32);
        [`Alcance ${fmtInt(r.paid.reach)}`, `Impressoes ${fmtInt(r.paid.impressions)}`, `Cliques ${fmtInt(r.paid.clicks)}`, `Conversoes ${fmtInt(r.paid.conversions)}`, `Investimento ${fmtMoney(r.paid.investment)}`].forEach((l, i) => text(l, M + 10 + colW, y - 45 - i * 8.6, 7.8, regular, INK));
        labelCaps('Total', M + 10 + colW * 2, y - 32);
        [`Cliques ${fmtInt(r.total.clicks)}`, `Conversoes ${fmtInt(r.total.conversions)}`].forEach((l, i) => text(l, M + 10 + colW * 2, y - 45 - i * 11, 8.5, regular, INK));
        y -= 96;
      }
      para('Alcance e impressoes nao sao somados entre organico e pago, porque as mesmas pessoas podem ter sido contadas nos dois. O total mostra apenas cliques e conversoes.', 8);
    }
    if (s.id === 'learnings') {
      textBlock('O que funcionou', t.worked);
      textBlock('O que pode melhorar', t.improve);
      textBlock('Aprendizados', t.learnings);
    }
    if (s.id === 'recommendations') para(t.recommendations ?? '');
    if (s.id === 'next') {
      textBlock('Objetivos', t.next_goals);
      textBlock('Testes', t.next_tests);
      textBlock('Pilares prioritarios', t.next_pillars);
      textBlock('Formatos', t.next_formats);
      textBlock('Proximos passos', t.next_steps);
    }
  }
  if (sections.length === 0 || !data.hasData) {
    // sem nenhum dado: avisa na primeira página interna em vez de gerar um PDF vazio
    if (doc.getPageCount() === 1) {
      newPage();
      text('Ainda nao ha metricas cadastradas para este mes.', M, y - 20, 12, regular, MUTED);
    }
  }

  // rodapé com número de página (exceto capa)
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (i === 0) return;
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.4, color: GRID });
    p.drawText(safe(`Soltria  -  ${data.client.name}  -  ${data.label}`, regular), { x: M, y: 28, size: 7.5, font: regular, color: MUTED });
    const label = `pag. ${i + 1} de ${pages.length}`;
    p.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: 28, size: 7.5, font: regular, color: MUTED });
  });
  return doc.save();
}
