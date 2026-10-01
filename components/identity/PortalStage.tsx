'use client';

import { useState } from 'react';
import { addStageComment } from '@/lib/actions/identity-portal';
import { STAGE_BY_KEY, type CommentRowLike, type StageData } from '@/lib/identity/types';
import { CommentThread } from '@/components/content/Thread';
import { IdentityApproval } from './PortalActions';
import { FinalMessage, IdentitySummary, StageView } from './views';
import { cn, fmtStamp } from '@/lib/utils';

/** Página de uma etapa no portal do cliente: apresentação, aprovação e comentários. */
export function PortalStage({ token, stage, allStages }: { token: string; stage: StageData; allStages: StageData[] }) {
  const meta = STAGE_BY_KEY[stage.stage_key];
  const current = stage.versions.find((v) => v.version_number === stage.current_version) ?? stage.versions[stage.versions.length - 1];
  const [selectedId, setSelectedId] = useState(current?.id);
  const pad = (n: number) => String(n).padStart(2, '0');
  const comments: CommentRowLike[] = stage.comments.map((c) => ({ ...c, content_id: c.project_id, slide_index: null }));
  const versionNumbers = Object.fromEntries(stage.versions.map((v) => [v.id, v.version_number]));
  const showComments = meta.approvable;

  // etapa em criação (ex.: nova versão sendo preparada): o conteúdo ainda não é exibido
  if (!current) {
    return (
      <div className="space-y-10">
        <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
          <p className="h-display text-2xl text-wine">Estamos preparando esta etapa ♡</p>
          <p className="max-w-md text-sm text-ink/60">Assim que estiver pronta, ela aparece aqui para você analisar.</p>
        </div>
        {showComments && stage.comments.length > 0 && (
          <CommentThread comments={comments as never} viewer="client" versionNumbers={versionNumbers} onSend={(m) => addStageComment(token, stage.id, m)} />
        )}
      </div>
    );
  }

  const selected = stage.versions.find((v) => v.id === selectedId) ?? current;
  const isCurrent = selected.id === current.id;
  const needsChoice = stage.stage_key === 'logo' && stage.status === 'awaiting' && !current.proposals.some((p) => p.is_chosen);

  return (
    <div className="space-y-12">
      {stage.versions.length > 1 && (
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
      {selected.note && isCurrent && (
        <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
          <strong className="font-normal">O que mudou:</strong> {selected.note}
        </p>
      )}
      {!isCurrent && (
        <p className="rounded-2xl border border-dashed border-wine/40 px-4 py-3 text-sm text-wine">
          Você está vendo uma versão anterior ({fmtStamp(selected.created_at)}). A aprovação vale para a versão atual.{' '}
          <button className="underline underline-offset-2" onClick={() => setSelectedId(current.id)}>Voltar para a versão atual</button>
        </p>
      )}

      {stage.stage_key === 'final' ? (
        <div className="space-y-8">
          <FinalMessage content={selected.content} />
          <IdentitySummary stages={allStages} />
        </div>
      ) : (
        <StageView stage={stage} version={selected} portal={{ token }} />
      )}

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

      {showComments && (
        <CommentThread comments={comments as never} viewer="client" versionNumbers={versionNumbers} onSend={(m) => addStageComment(token, stage.id, m)} />
      )}
    </div>
  );
}
