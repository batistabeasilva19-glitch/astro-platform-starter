import 'server-only';
import { NextResponse } from 'next/server';
import { slugify } from '@/lib/utils';
import type { Answers } from './briefing';
import { buildBriefingPdf } from './briefing-pdf';
import type { IdentityDetail } from './types';

/** Monta a resposta HTTP com o PDF do formulário a partir do detalhe do projeto. */
export async function briefingPdfResponse(opts: { detail: IdentityDetail; clientName: string; origin: string; inline?: boolean }) {
  const { detail } = opts;
  const stage = detail.stages.find((s) => s.stage_key === 'briefing');
  if (!stage) return new NextResponse('Formulário não encontrado.', { status: 404 });
  const version = stage.versions.find((v) => v.version_number === stage.current_version) ?? stage.versions[stage.versions.length - 1];
  const answers = (version?.content.answers ?? {}) as Answers;
  const brandName = (typeof answers.brand_name === 'string' && answers.brand_name.trim()) || opts.clientName;

  const bytes = await buildBriefingPdf({
    brandName,
    projectName: detail.project.name,
    clientName: opts.clientName,
    answers,
    references: (version?.assets ?? []).filter((a) => a.slot === 'reference').map((a) => ({ url: a.url, caption: a.caption, name: a.file_name })),
    submittedBy: stage.status === 'approved' ? stage.approved_by : null,
    submittedAt: stage.status === 'approved' ? stage.approved_at : null,
    logoUrl: `${opts.origin}/brand/logo.png`,
  });
  const filename = `formulario-da-marca-${slugify(brandName) || 'soltria'}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${opts.inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
