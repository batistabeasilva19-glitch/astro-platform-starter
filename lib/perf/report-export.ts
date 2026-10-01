import 'server-only';
import { NextResponse } from 'next/server';
import { signReportAssets } from '@/lib/data/perf';
import { monthName } from './calc';
import type { ReportData } from './report';
import { buildReportPdf } from './report-pdf';
import type { ReportEdits } from './types';

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Relatorio_Soltria_NomeCliente_Setembro_2026.pdf */
export function reportFileName(data: ReportData) {
  const client = plain(data.client.name).replace(/[^A-Za-z0-9]+/g, '') || 'Cliente';
  return `Relatorio_Soltria_${client}_${plain(monthName(data.month))}_${data.month.slice(0, 4)}.pdf`;
}

export async function reportPdfResponse(opts: { data: ReportData; edits: ReportEdits; origin: string; inline?: boolean }) {
  const { thumbs, logo } = await signReportAssets(opts.data);
  const bytes = await buildReportPdf({ data: opts.data, edits: opts.edits, thumbs, clientLogoUrl: logo, soltriaLogoUrl: `${opts.origin}/brand/logo.png` });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${opts.inline ? 'inline' : 'attachment'}; filename="${reportFileName(opts.data)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
