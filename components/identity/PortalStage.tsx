'use client';

import { useState } from 'react';
import { addStageComment } from '@/lib/actions/identity-portal';
import { STAGE_BY_KEY, type CommentRowLike, type IdentityDetail, type StageData } from '@/lib/identity/types';
import { CommentThread } from '@/components/content/Thread';
import { IdentityApproval } from './PortalActions';
import { StageView } from './views';
import type { ViewCtx } from './view-context';
import { cn, fmtStamp } from '@/lib/utils';

/** Página de uma etapa no portal do cliente: apresentação, aprovação e comentários. */
export function PortalStage({ token, stage, detail }: { token: string; stage: StageData; detail: IdentityDetail }) {
  const meta = STAGE_BY_KEY[stage.stage_key];
  const current = stage.versions.find((v) => v.version_number === stage.current_version) ?? stage.versions[stage.versions.length - 1];
  const [selectedId, setSelectedId] = useState(current?.id);
  const pad = (n: number) => String(n).padStart(2, '0');
  const comments: CommentRowLike[] = stage.comments.map((c) => ({ ...c, content_id: c.project_id, slide_index: null }));
  const versionNumbers = Object.fromEntries(stage.versions.map((v) => [v.id, v.version_number]));
  const showComments = meta.approvable;
  const isLogo = stage.stage_key === 'logo';
  const ctx: ViewCtx = { mode: 'client', token, stage, allStages: detail.stages, favorites: detail.favorites, selections: detail.selections, annotations: detail.annotations };

  // etapa em criação (ex.: nova versão sendo preparada) ou ainda não liberada: o conteúdo não é exibido
  if (!current) {
    const final = stage.stage_key === 'final';
    return (
      <div className="space-y-10">
        <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
          <p className="h-display text-2xl text-wine">{final ? 'A aprovação final chega em breve ♡' : 'Estamos preparando esta etapa ♡'}</p>
          <p className="max-w-md text-sm text-ink/60">{final ? 'Quando todas as etapas estiverem aprovadas, você verá aqui o resumo da sua identidade para a aprovação final.' : 'Assim que estiver pronta, ela aparece aqui para você analisar.'}</p>
        </div>
        {showComments && stage.comments.length > 0 && <CommentThread comments={comments as never} viewer="client" versionNumbers={versionNumbers} onSend={(m) => addStageComment(token, stage.id, m)} />}
      </div>
    );
  }

  const selected = stage.versions.find((v) => v.id === selectedId) ?? current;
  const isCurrent = selected.id === current.id;
  const needsChoice = isLogo && stage.status === 'awaiting' && !stage.proposals.some((p) => p.is_chosen);

  return (
    <div className="space-y-12">
      {!isLogo && stage.versions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-3 py-1 text-[0.7rem]', isCurrent ? 'bg-wine text-white' : 'border border-wine/30 text-wine')}>
            {isCurrent ? `Versão atual · ${pad(selected.version_number)}` : `Versão ${pad(selected.version_number)} · anterior`}
          </span>
          {[...stage.versions].reverse().map((v) => (
            <button key={v.id} onClick={() => setSelectedId(v.id)} className={cn('rounded-full border px-2.5 py-1 text-[0.7rem] transition', selectedId === v.id ? 'border-wine bg-blush text-wine' : 'border-wine/20 text-ink/60 hover:bg-blush')}>
              V{pad(v.version_number)}
            </button>
          ))}
        </div>
      )}
      {!isLogo && selected.note && isCurrent && (
        <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine"><strong className="font-normal">O que mudou:</strong> {selected.note}</p>
      )}
      {!isLogo && !isCurrent && (
        <p className="rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">
          Você está vendo uma versão anterior ({fmtStamp(selected.created_at)}). A aprovação vale para a versão atual.{' '}
          <button className="underline underline-offset-2" onClick={() => setSelectedId(current.id)}>Voltar para a versão atual</button>
        </p>
      )}

      {stage.stage_key === 'final' && stage.status === 'approved' && (
        <div className="rounded-[2rem] bg-wine px-6 py-10 text-center text-white">
          <p className="script text-5xl text-blush sm:text-6xl">Identidade aprovada ♡</p>
          <p className="label mt-3 text-white/70">IDENTIDADE APROVADA</p>
        </div>
      )}

      <StageView ctx={ctx} version={selected} />

      {meta.approvable && (
        <IdentityApproval
          token={token}
          stageId={stage.id}
          stageKey={stage.stage_key}
          versionId={current.id}
          versionNumber={current.version_number}
          status={stage.status}
          approvedBy={stage.approved_by}
          approvedAt={stage.approved_at}
          isCurrent={isCurrent}
          needsChoice={needsChoice}
        />
      )}

      {showComments && <CommentThread comments={comments as never} viewer="client" versionNumbers={versionNumbers} onSend={(m) => addStageComment(token, stage.id, m)} />}
    </div>
  );
}
