'use client';

import type { Answers } from '@/lib/identity/briefing';
import type { VersionData } from '@/lib/identity/types';
import { BriefingForm } from '../briefing/BriefingForm';
import { BriefingSummary } from '../briefing/BriefingSummary';
import type { ViewCtx } from '../view-context';

/** Cliente: formulário editável (ou o resumo depois de enviado). Administradora: resumo das respostas. */
export function BriefingView({ ctx, version }: { ctx: ViewCtx; version: VersionData }) {
  const answers = (version.content.answers ?? {}) as Answers;
  const references = version.assets.filter((a) => a.slot === 'reference');
  if (ctx.mode === 'client' && ctx.token) return <BriefingForm token={ctx.token} stage={ctx.stage} initial={answers} references={references} />;
  return <BriefingSummary answers={answers} references={references} />;
}
